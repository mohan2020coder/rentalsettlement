package billing

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"rental-settlement/backend/pkg/response"
)

// Repository persists plans, subscriptions and usage metrics.
type Repository struct {
	db *gorm.DB
}

// NewRepository builds a billing repository.
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// DB exposes the raw database handle for cross-store transactions.
func (r *Repository) DB() *gorm.DB { return r.db }

// ActivePlans returns all active plans ordered by price.
func (r *Repository) ActivePlans(ctx context.Context) ([]Plan, error) {
	var plans []Plan
	err := r.db.WithContext(ctx).
		Where("is_active = true").
		Order("price_minor asc").
		Find(&plans).Error
	return plans, err
}

// PlanByCode finds a plan by its unique code.
func (r *Repository) PlanByCode(ctx context.Context, code string) (*Plan, error) {
	var p Plan
	err := r.db.WithContext(ctx).Where("code = ?", code).First(&p).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "PLAN_NOT_FOUND", "Plan not found")
		}
		return nil, err
	}
	return &p, nil
}

// CurrentSubscription returns the user's current subscription, if any.
func (r *Repository) CurrentSubscription(ctx context.Context, userID uuid.UUID) (*Subscription, error) {
	var s Subscription
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND is_current = true", userID).
		First(&s).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "SUBSCRIPTION_NOT_FOUND", "No active subscription")
		}
		return nil, err
	}
	return &s, nil
}

// CreateSubscription inserts a subscription row.
func (r *Repository) CreateSubscription(ctx context.Context, s *Subscription) error {
	return r.db.WithContext(ctx).Create(s).Error
}

// UpdateSubscription persists subscription changes.
func (r *Repository) UpdateSubscription(ctx context.Context, s *Subscription) error {
	return r.db.WithContext(ctx).Save(s).Error
}

// UpsertMetric atomically adjusts a usage counter for a user.
func (r *Repository) UpsertMetric(ctx context.Context, userID uuid.UUID, resourceType string, delta int64) (int64, error) {
	var metric UsageMetric
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ? AND resource_type = ?", userID, resourceType).
			First(&metric).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				metric = UsageMetric{
					UserID:       userID,
					ResourceType: resourceType,
					CurrentValue: 0,
				}
				if err := tx.Create(&metric).Error; err != nil {
					return err
				}
			} else {
				return err
			}
		}
		metric.CurrentValue += delta
		if metric.CurrentValue < 0 {
			metric.CurrentValue = 0
		}
		return tx.Model(&metric).Update("current_value", metric.CurrentValue).Error
	})
	if err != nil {
		return 0, err
	}
	return metric.CurrentValue, nil
}

// Metric returns the current value of a usage counter (0 when absent).
func (r *Repository) Metric(ctx context.Context, userID uuid.UUID, resourceType string) (int64, error) {
	var metric UsageMetric
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND resource_type = ?", userID, resourceType).
		First(&metric).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, nil
		}
		return 0, err
	}
	return metric.CurrentValue, nil
}

// AppendUsageRecord writes an audit-friendly usage event.
func (r *Repository) AppendUsageRecord(ctx context.Context, rec *UsageRecord) error {
	return r.db.WithContext(ctx).Create(rec).Error
}
