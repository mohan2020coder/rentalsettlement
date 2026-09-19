package tenancies

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"rental-settlement/backend/pkg/response"
)

// Repository persists tenancies.
type Repository struct {
	db *gorm.DB
}

// NewRepository builds a tenancy repository.
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a tenancy.
func (r *Repository) Create(ctx context.Context, t *Tenancy) error {
	return r.db.WithContext(ctx).Create(t).Error
}

// ByID returns a tenancy by primary key.
func (r *Repository) ByID(ctx context.Context, id uuid.UUID) (*Tenancy, error) {
	var t Tenancy
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&t).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "TENANCY_NOT_FOUND", "Tenancy not found")
		}
		return nil, err
	}
	return &t, nil
}

// ListForUser returns tenancies the user is party to (landlord or tenant).
func (r *Repository) ListForUser(ctx context.Context, userID uuid.UUID) ([]Tenancy, error) {
	var list []Tenancy
	err := r.db.WithContext(ctx).
		Where("landlord_id = ? OR tenant_id = ?", userID, userID).
		Order("created_at desc").
		Find(&list).Error
	return list, err
}

// ActiveCountForLandlord counts occupying tenancies for a landlord.
func (r *Repository) ActiveCountForLandlord(ctx context.Context, landlordID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&Tenancy{}).
		Where("landlord_id = ? AND status IN ?", landlordID, []string{StatusInvited, StatusActive, StatusNoticeGiven, StatusMoveOut}).
		Count(&count).Error
	return count, err
}

// ActiveByToken finds the active tenancy matching an invitation token.
func (r *Repository) ActiveByToken(ctx context.Context, token string) (*Tenancy, error) {
	var t Tenancy
	err := r.db.WithContext(ctx).
		Where("invite_token = ? AND status = ?", token, StatusInvited).
		First(&t).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "TENANCY_NOT_FOUND", "Invitation not found or already used")
		}
		return nil, err
	}
	return &t, nil
}

// Update persists tenancy changes.
func (r *Repository) Update(ctx context.Context, t *Tenancy) error {
	return r.db.WithContext(ctx).Save(t).Error
}

// CountByProperty counts tenancies for a property.
func (r *Repository) CountByProperty(ctx context.Context, propertyID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&Tenancy{}).
		Where("property_id = ?", propertyID).
		Count(&count).Error
	return count, err
}
