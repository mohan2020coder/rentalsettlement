package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"rental-settlement/backend/pkg/response"
)

// RefreshToken is the persisted record behind a signed refresh token. Only the
// SHA-256 hash of the token is stored, never the token itself.
type RefreshToken struct {
	ID        uuid.UUID  `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID  `gorm:"column:user_id;type:uuid" json:"user_id"`
	TokenHash string     `gorm:"column:token_hash" json:"-"`
	ExpiresAt time.Time  `gorm:"column:expires_at" json:"expires_at"`
	RevokedAt *time.Time `gorm:"column:revoked_at" json:"revoked_at"`
	IPAddress string     `gorm:"column:ip_address" json:"ip_address"`
	UserAgent string     `gorm:"column:user_agent" json:"user_agent"`
	CreatedAt time.Time  `json:"created_at"`
}

func (RefreshToken) TableName() string { return "refresh_tokens" }

// hashToken returns the hex SHA-256 of a token string.
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// TokenRepository persists refresh tokens.
type TokenRepository struct {
	db *gorm.DB
}

// NewTokenRepository builds the refresh-token repository.
func NewTokenRepository(db *gorm.DB) *TokenRepository {
	return &TokenRepository{db: db}
}

// Create stores a new refresh-token record.
func (r *TokenRepository) Create(ctx context.Context, rt *RefreshToken) error {
	return r.db.WithContext(ctx).Create(rt).Error
}

// ByID loads a refresh-token record (regardless of revocation state).
func (r *TokenRepository) ByID(ctx context.Context, id uuid.UUID) (*RefreshToken, error) {
	var rt RefreshToken
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&rt).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(401, "INVALID_REFRESH_TOKEN", "Invalid refresh token")
		}
		return nil, err
	}
	return &rt, nil
}

// Revoke marks a record as revoked. Returns false when the record was already
// revoked or missing.
func (r *TokenRepository) Revoke(ctx context.Context, id uuid.UUID) (bool, error) {
	res := r.db.WithContext(ctx).
		Model(&RefreshToken{}).
		Where("id = ? AND revoked_at IS NULL", id).
		Update("revoked_at", time.Now().UTC())
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected > 0, nil
}

// RevokeAllForUser revokes every active refresh token for a user (logout all).
func (r *TokenRepository) RevokeAllForUser(ctx context.Context, userID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&RefreshToken{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Update("revoked_at", time.Now().UTC()).Error
}
