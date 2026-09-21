package applications

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"rental-settlement/backend/pkg/response"
)

// Repository persists property applications.
type Repository struct {
	db *gorm.DB
}

// NewRepository builds an application repository.
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts an application.
func (r *Repository) Create(ctx context.Context, a *Application) error {
	return r.db.WithContext(ctx).Create(a).Error
}

// ByID returns an application by primary key.
func (r *Repository) ByID(ctx context.Context, id uuid.UUID) (*Application, error) {
	var a Application
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&a).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "APPLICATION_NOT_FOUND", "Application not found")
		}
		return nil, err
	}
	return &a, nil
}

// ListForUser returns applications where the user is the tenant or the owner
// of the property.
func (r *Repository) ListForUser(ctx context.Context, userID uuid.UUID) ([]Application, error) {
	var list []Application
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? OR landlord_id = ?", userID, userID).
		Order("created_at desc").
		Find(&list).Error
	return list, err
}

// ExistsPending reports whether the tenant already has an open application on
// the property.
func (r *Repository) ExistsPending(ctx context.Context, propertyID, tenantID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&Application{}).
		Where("property_id = ? AND tenant_id = ? AND status = ?", propertyID, tenantID, StatusPending).
		Count(&count).Error
	return count > 0, err
}

// Update persists application changes.
func (r *Repository) Update(ctx context.Context, a *Application) error {
	return r.db.WithContext(ctx).Save(a).Error
}
