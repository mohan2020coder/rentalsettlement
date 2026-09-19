package auth

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/billing"
	"rental-settlement/backend/internal/users"
	"rental-settlement/backend/pkg/middleware"
	"rental-settlement/backend/pkg/response"
)

// Service implements authentication business rules.
type Service struct {
	users   *users.Repository
	tokens  *TokenRepository
	billing *billing.Service
	audit   *audit.Service
	jwt     *Manager
}

// NewService builds the authentication service.
func NewService(userRepo *users.Repository, tokenRepo *TokenRepository, billingSvc *billing.Service, auditSvc *audit.Service, mgr *Manager) *Service {
	return &Service{users: userRepo, tokens: tokenRepo, billing: billingSvc, audit: auditSvc, jwt: mgr}
}

// Register creates a new user, assigns the free plan, and returns tokens.
func (s *Service) Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error) {
	if details := req.Validate(); len(details) > 0 {
		return nil, &response.AppError{Status: 400, Code: "VALIDATION_ERROR", Message: "Invalid request", Details: details}
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	hash, err := hashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	phone := nullableString(req.Phone)
	user := &users.User{
		Name:         strings.TrimSpace(req.Name),
		Email:        email,
		Phone:        phone,
		PasswordHash: hash,
		Role:         strings.ToUpper(req.Role),
		Status:       users.StatusActive,
	}

	if err := s.users.Create(ctx, user); err != nil {
		if isUniqueViolation(err) {
			return nil, response.NewError(409, "EMAIL_TAKEN", "An account with this email already exists")
		}
		return nil, err
	}

	// Free plan for every new account. Billing is a separate module.
	if err := s.billing.EnsureFreeSubscription(ctx, user.ID); err != nil {
		return nil, err
	}

	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &user.ID,
		Action:     audit.ActionUserRegistered,
		EntityType: "user",
		EntityID:   &user.ID,
	})

	resp, err := s.issueTokens(ctx, user.ID, user.Role, user.Email)
	if err != nil {
		return nil, err
	}
	dto := users.ToUserDTO(user)
	resp.User = dto
	return resp, nil
}

// Login authenticates a user and returns fresh tokens.
func (s *Service) Login(ctx context.Context, req LoginRequest) (*AuthResponse, error) {
	if details := req.Validate(); len(details) > 0 {
		return nil, &response.AppError{Status: 400, Code: "VALIDATION_ERROR", Message: "Invalid request", Details: details}
	}

	user, err := s.users.ByEmail(ctx, strings.ToLower(strings.TrimSpace(req.Email)))
	if err != nil {
		return nil, response.NewError(401, "INVALID_CREDENTIALS", "Invalid email or password")
	}
	if user.Status != users.StatusActive {
		return nil, response.NewError(403, "USER_DISABLED", "This account has been disabled")
	}
	ok, err := verifyPassword(user.PasswordHash, req.Password)
	if err != nil || !ok {
		return nil, response.NewError(401, "INVALID_CREDENTIALS", "Invalid email or password")
	}

	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &user.ID,
		Action:     audit.ActionUserLoggedIn,
		EntityType: "user",
		EntityID:   &user.ID,
	})

	resp, err := s.issueTokens(ctx, user.ID, user.Role, user.Email)
	if err != nil {
		return nil, err
	}
	dto := users.ToUserDTO(user)
	resp.User = dto
	return resp, nil
}

// Refresh validates a refresh token, revokes it, and issues a new token pair.
func (s *Service) Refresh(ctx context.Context, req RefreshRequest) (*AuthResponse, error) {
	if details := req.Validate(); len(details) > 0 {
		return nil, &response.AppError{Status: 400, Code: "VALIDATION_ERROR", Message: "Invalid request", Details: details}
	}
	claims, err := s.jwt.ParseRefresh(req.RefreshToken)
	if err != nil {
		return nil, response.NewError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token")
	}

	record, err := s.tokens.ByID(ctx, claims.TokenID)
	if err != nil {
		return nil, err
	}
	if record.RevokedAt != nil {
		return nil, response.NewError(401, "REFRESH_TOKEN_REVOKED", "This session has been revoked")
	}
	if hashToken(req.RefreshToken) != record.TokenHash {
		return nil, response.NewError(401, "INVALID_REFRESH_TOKEN", "Invalid refresh token")
	}
	if time.Now().UTC().After(record.ExpiresAt) {
		return nil, response.NewError(401, "REFRESH_TOKEN_EXPIRED", "This session has expired")
	}

	user, err := s.users.ByID(ctx, claims.UserID)
	if err != nil {
		return nil, err
	}
	// Rotate: revoke the used token, then issue new tokens.
	if _, err := s.tokens.Revoke(ctx, record.ID); err != nil {
		return nil, err
	}
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &user.ID,
		Action:     audit.ActionTokenRefreshed,
		EntityType: "user",
		EntityID:   &user.ID,
	})
	resp, err := s.issueTokens(ctx, user.ID, user.Role, user.Email)
	if err != nil {
		return nil, err
	}
	dto := users.ToUserDTO(user)
	resp.User = dto
	return resp, nil
}

// Logout revokes the presented refresh token (or all tokens for the user when
// no token is provided).
func (s *Service) Logout(ctx context.Context, userID uuid.UUID, refreshToken string) error {
	if refreshToken != "" {
		claims, err := s.jwt.ParseRefresh(refreshToken)
		if err == nil {
			_, _ = s.tokens.Revoke(ctx, claims.TokenID)
		} else {
			// If we cannot parse it, revoke all active tokens as a fallback.
			_ = s.tokens.RevokeAllForUser(ctx, userID)
		}
	} else {
		_ = s.tokens.RevokeAllForUser(ctx, userID)
	}
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		Action:     audit.ActionUserLoggedOut,
		EntityType: "user",
		EntityID:   &userID,
	})
	return nil
}

func (s *Service) issueTokens(ctx context.Context, userID uuid.UUID, role, email string) (*AuthResponse, error) {
	ip, ua := middleware.ClientMeta(ctx)

	refreshExp := time.Now().UTC().Add(s.jwt.RefreshTTL())
	record := RefreshToken{
		ID:        uuid.New(),
		UserID:    userID,
		ExpiresAt: refreshExp,
		IPAddress: ip,
		UserAgent: ua,
	}

	refresh, exp, err := s.jwt.IssueRefresh(record.ID, userID)
	if err != nil {
		return nil, err
	}
	record.TokenHash = hashToken(refresh)
	record.ExpiresAt = exp
	if err := s.tokens.Create(ctx, &record); err != nil {
		return nil, err
	}

	access, _, err := s.jwt.IssueAccess(userID, role, email)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		AccessToken:  access,
		RefreshToken: refresh,
		ExpiresIn:    int64(s.jwt.AccessTTL().Seconds()),
	}, nil
}

func nullableString(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
