package users

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"rental-settlement/backend/pkg/response"
)

// Repository persists users.
type Repository struct {
	db *gorm.DB
}

// NewRepository builds a user repository.
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new user.
func (r *Repository) Create(ctx context.Context, u *User) error {
	return r.db.WithContext(ctx).Create(u).Error
}

// ByID returns a user by primary key.
func (r *Repository) ByID(ctx context.Context, id uuid.UUID) (*User, error) {
	var u User
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&u).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "USER_NOT_FOUND", "User not found")
		}
		return nil, err
	}
	return &u, nil
}

// ByEmail finds a user by (case-insensitive) email.
func (r *Repository) ByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	err := r.db.WithContext(ctx).Where("lower(email) = lower(?)", email).First(&u).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "USER_NOT_FOUND", "User not found")
		}
		return nil, err
	}
	return &u, nil
}

// Update saves changes to a user.
func (r *Repository) Update(ctx context.Context, u *User) error {
	return r.db.WithContext(ctx).Save(u).Error
}
