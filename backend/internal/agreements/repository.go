package agreements

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"rental-settlement/backend/pkg/response"
)

// Repository persists agreement versions.
type Repository struct {
	db *gorm.DB
}

// NewRepository builds an agreement repository.
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts an agreement version.
func (r *Repository) Create(ctx context.Context, v *RentalAgreementVersion) error {
	return r.db.WithContext(ctx).Create(v).Error
}

// Latest returns the newest version for a tenancy.
func (r *Repository) Latest(ctx context.Context, tenancyID uuid.UUID) (*RentalAgreementVersion, error) {
	var v RentalAgreementVersion
	err := r.db.WithContext(ctx).
		Where("tenancy_id = ?", tenancyID).
		Order("version_number desc").
		First(&v).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "AGREEMENT_NOT_FOUND", "No agreement version found for this tenancy")
		}
		return nil, err
	}
	return &v, nil
}

// ByVersion returns a specific version of a tenancy's agreement.
func (r *Repository) ByVersion(ctx context.Context, tenancyID uuid.UUID, version int) (*RentalAgreementVersion, error) {
	var v RentalAgreementVersion
	err := r.db.WithContext(ctx).
		Where("tenancy_id = ? AND version_number = ?", tenancyID, version).
		First(&v).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "AGREEMENT_NOT_FOUND", "Agreement version not found")
		}
		return nil, err
	}
	return &v, nil
}

// ListVersions returns all versions for a tenancy, newest first.
func (r *Repository) ListVersions(ctx context.Context, tenancyID uuid.UUID) ([]RentalAgreementVersion, error) {
	var list []RentalAgreementVersion
	err := r.db.WithContext(ctx).
		Where("tenancy_id = ?", tenancyID).
		Order("version_number desc").
		Find(&list).Error
	return list, err
}

// Update persists version changes (confirmations).
func (r *Repository) Update(ctx context.Context, v *RentalAgreementVersion) error {
	return r.db.WithContext(ctx).Save(v).Error
}
