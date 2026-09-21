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

// ListingFilter narrows a catalog search.
type ListingFilter struct {
	City         string
	MaxRentMinor *int64
	Bedrooms     *int
	Furnishing   string
	Limit        int
}

// ListListed returns ACTIVE, landlord-listed properties, newest first.
func (r *Repository) ListListed(ctx context.Context, f ListingFilter) ([]Property, error) {
	q := r.db.WithContext(ctx).
		Where("listed = ? AND status = ?", true, StatusActive)
	if f.City != "" {
		q = q.Where("city ILIKE ?", "%"+f.City+"%")
	}
	if f.MaxRentMinor != nil {
		q = q.Where("monthly_rent_minor <= ?", *f.MaxRentMinor)
	}
	if f.Bedrooms != nil {
		q = q.Where("bedrooms >= ?", *f.Bedrooms)
	}
	if f.Furnishing != "" {
		q = q.Where("furnishing_status = ?", f.Furnishing)
	}
	if f.Limit <= 0 || f.Limit > 100 {
		f.Limit = 50
	}
	var list []Property
	err := q.Order("created_at desc").Limit(f.Limit).Find(&list).Error
	return list, err
}

// UnlistByProperty removes a property from the tenant catalog.
func (r *Repository) UnlistByProperty(ctx context.Context, propertyID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&Property{}).
		Where("id = ?", propertyID).
		Update("listed", false).Error
}

// RelistByProperty returns an ACTIVE property to the tenant catalog.
func (r *Repository) RelistByProperty(ctx context.Context, propertyID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&Property{}).
		Where("id = ? AND status = ?", propertyID, StatusActive).
		Update("listed", true).Error
}

// Update persists property changes.
func (r *Repository) Update(ctx context.Context, p *Property) error {
	return r.db.WithContext(ctx).Save(p).Error
}
