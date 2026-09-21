package settlements

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"rental-settlement/backend/pkg/response"
)

// Repository persists settlements and their items/events.
type Repository struct {
	db *gorm.DB
}

// NewRepository builds the settlement repository.
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a settlement.
func (r *Repository) Create(ctx context.Context, s *Settlement) error {
	return r.db.WithContext(ctx).Create(s).Error
}

// ByTenancy returns the settlement for a tenancy.
func (r *Repository) ByTenancy(ctx context.Context, tenancyID uuid.UUID) (*Settlement, error) {
	var s Settlement
	err := r.db.WithContext(ctx).Where("tenancy_id = ?", tenancyID).First(&s).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "SETTLEMENT_NOT_FOUND", "No settlement found for this tenancy")
		}
		return nil, err
	}
	return r.load(ctx, &s)
}

// Update persists a settlement.
func (r *Repository) Update(ctx context.Context, s *Settlement) error {
	return r.db.WithContext(ctx).Save(s).Error
}

// AddItem inserts a settlement line.
func (r *Repository) AddItem(ctx context.Context, i *Item) error {
	return r.db.WithContext(ctx).Create(i).Error
}

// RemoveItems deletes all lines of a settlement so they can be rebuilt.
func (r *Repository) RemoveItems(ctx context.Context, settlementID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("settlement_id = ?", settlementID).Delete(&Item{}).Error
}

// AddEvent appends a settlement event.
func (r *Repository) AddEvent(ctx context.Context, e *Event) error {
	return r.db.WithContext(ctx).Create(e).Error
}

func (r *Repository) load(ctx context.Context, s *Settlement) (*Settlement, error) {
	if err := r.db.WithContext(ctx).
		Where("settlement_id = ?", s.ID).
		Order("created_at asc").
		Find(&s.Items).Error; err != nil {
		return nil, err
	}
	if err := r.db.WithContext(ctx).
		Where("settlement_id = ?", s.ID).
		Order("created_at asc").
		Find(&s.Events).Error; err != nil {
		return nil, err
	}
	return s, nil
}
