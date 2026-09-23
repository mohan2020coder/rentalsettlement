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

// Create inserts a property and its photos.
func (r *Repository) Create(ctx context.Context, p *Property) error {
	return r.db.WithContext(ctx).Create(p).Error
}

// photoPreload loads each property's photos in gallery order.
func photoPreload(q *gorm.DB) *gorm.DB {
	return q.Preload("Photos", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order asc")
	})
}

// ByID returns a property by primary key.
func (r *Repository) ByID(ctx context.Context, id uuid.UUID) (*Property, error) {
	var p Property
	err := photoPreload(r.db.WithContext(ctx)).Where("id = ?", id).First(&p).Error
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
	err := photoPreload(r.db.WithContext(ctx)).
		Where("landlord_id = ?", landlordID).
		Order("created_at desc").
		Find(&list).Error
	return list, err
}

// PropertyNames returns a lookup of property id -> property name for the given
// ids. Unknown ids are omitted.
func (r *Repository) PropertyNames(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]string, error) {
	out := map[uuid.UUID]string{}
	if len(ids) == 0 {
		return out, nil
	}
	var rows []struct {
		ID           uuid.UUID
		PropertyName string
	}
	if err := r.db.WithContext(ctx).
		Model(&Property{}).
		Select("id, property_name").
		Where("id IN ?", ids).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.ID] = r.PropertyName
	}
	return out, nil
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
	err := photoPreload(q).Order("created_at desc").Limit(f.Limit).Find(&list).Error
	return list, err
}

// ReplacePhotos sets a property's photo gallery to the given storage keys,
// preserving gallery order. The cover column on properties is kept in sync by
// the caller.
func (r *Repository) ReplacePhotos(ctx context.Context, propertyID uuid.UUID, keys []string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("property_id = ?", propertyID).Delete(&PropertyPhoto{}).Error; err != nil {
			return err
		}
		for i, key := range keys {
			photo := PropertyPhoto{PropertyID: propertyID, FilePath: key, SortOrder: i}
			if err := tx.Create(&photo).Error; err != nil {
				return err
			}
		}
		return nil
	})
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

// Update persists property changes. Photo rows are managed separately via
// ReplacePhotos, so the association is excluded from the save to avoid GORM's
// association upsert clashing with the (property_id, file_path) unique index.
func (r *Repository) Update(ctx context.Context, p *Property) error {
	return r.db.WithContext(ctx).Omit("Photos").Save(p).Error
}

// HasTenancyMember reports whether the user is party to a tenancy on the
// property. This crosses into the tenancies table without importing that
// package to avoid an import cycle.
func (r *Repository) HasTenancyMember(ctx context.Context, userID uuid.UUID, propertyID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Table("tenancies").
		Where("property_id = ? AND (landlord_id = ? OR tenant_id = ?)", propertyID, userID, userID).
		Count(&count).Error
	return count > 0, err
}
