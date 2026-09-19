package properties

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"rental-settlement/backend/pkg/response"
)

// Repository persists properties.
type Repository struct {
	db *gorm.DB
}

// NewRepository builds a property repository.
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a property.
func (r *Repository) Create(ctx context.Context, p *Property) error {
	return r.db.WithContext(ctx).Create(p).Error
}

// ByID returns a property by primary key.
func (r *Repository) ByID(ctx context.Context, id uuid.UUID) (*Property, error) {
	var p Property
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&p).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "PROPERTY_NOT_FOUND", "Property not found")
		}
		return nil, err
	}
	return &p, nil
}

// ListByLandlord returns a landlord's properties.
func (r *Repository) ListByLandlord(ctx context.Context, landlordID uuid.UUID) ([]Property, error) {
	var list []Property
	err := r.db.WithContext(ctx).
		Where("landlord_id = ?", landlordID).
		Order("created_at desc").
		Find(&list).Error
	return list, err
}

// CountByLandlord counts a landlord's properties.
func (r *Repository) CountByLandlord(ctx context.Context, landlordID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&Property{}).
		Where("landlord_id = ?", landlordID).
		Count(&count).Error
	return count, err
}

// Update persists property changes.
func (r *Repository) Update(ctx context.Context, p *Property) error {
	return r.db.WithContext(ctx).Save(p).Error
}
