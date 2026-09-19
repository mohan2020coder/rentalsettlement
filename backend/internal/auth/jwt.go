package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// TokenType distinguishes access from refresh tokens.
type TokenType string

const (
	TokenAccess  TokenType = "access"
	TokenRefresh TokenType = "refresh"
)

// Claims is the JWT payload for both access and refresh tokens.
type Claims struct {
	Type    TokenType `json:"typ"`
	UserID  uuid.UUID `json:"uid"`
	Role    string    `json:"rol"`
	TokenID uuid.UUID `json:"jti"`
	Email   string    `json:"email,omitempty"`
	jwt.RegisteredClaims
}

// Manager issues and parses JWTs.
type Manager struct {
	accessSecret  []byte
	refreshSecret []byte
	accessTTL     time.Duration
	refreshTTL    time.Duration
}

// NewManager builds a JWT manager from configuration.
func NewManager(accessSecret, refreshSecret string, accessTTL, refreshTTL time.Duration) *Manager {
	return &Manager{
		accessSecret:  []byte(accessSecret),
		refreshSecret: []byte(refreshSecret),
		accessTTL:     accessTTL,
		refreshTTL:    refreshTTL,
	}
}

func (m *Manager) sign(claims *Claims, secret []byte) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

// IssueAccess creates a short-lived access token.
func (m *Manager) IssueAccess(userID uuid.UUID, role, email string) (string, time.Time, error) {
	now := time.Now().UTC()
	exp := now.Add(m.accessTTL)
	claims := Claims{
		Type:   TokenAccess,
		UserID: userID,
		Role:   role,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
			ID:        uuid.NewString(),
		},
	}
	tok, err := m.sign(&claims, m.accessSecret)
	return tok, exp, err
}

// IssueRefresh creates a long-lived refresh token referencing a stored record
// via its jti.
func (m *Manager) IssueRefresh(tokenID uuid.UUID, userID uuid.UUID) (string, time.Time, error) {
	now := time.Now().UTC()
	exp := now.Add(m.refreshTTL)
	claims := Claims{
		Type:    TokenRefresh,
		UserID:  userID,
		TokenID: tokenID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
			ID:        uuid.NewString(),
		},
	}
	tok, err := m.sign(&claims, m.refreshSecret)
	return tok, exp, err
}

// Parse parses a token with the given secret and validates its type.
func (m *Manager) Parse(raw string, secret []byte, tokenType TokenType) (*Claims, error) {
	claims := &Claims{}
	parser := jwt.NewParser(jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())
	token, err := parser.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) {
		return secret, nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid token")
	}
	if claims.Type != tokenType {
		return nil, errors.New("wrong token type")
	}
	return claims, nil
}

// ParseAccess validates an access token.
func (m *Manager) ParseAccess(raw string) (*Claims, error) {
	return m.Parse(raw, m.accessSecret, TokenAccess)
}

// ParseRefresh validates a refresh token.
func (m *Manager) ParseRefresh(raw string) (*Claims, error) {
	return m.Parse(raw, m.refreshSecret, TokenRefresh)
}

// AccessTTL exposes the configured access token lifetime.
func (m *Manager) AccessTTL() time.Duration { return m.accessTTL }

// RefreshTTL exposes the configured refresh token lifetime.
func (m *Manager) RefreshTTL() time.Duration { return m.refreshTTL }
