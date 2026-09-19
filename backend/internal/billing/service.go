package billing

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"rental-settlement/backend/pkg/response"
)

// Service implements billing business rules: plans, subscriptions, usage and
// simulated plan changes. A real payment provider can replace
// ChangeSubscription later through the PaymentProvider abstraction.
type Service struct {
	repo *Repository
}

// NewService builds the billing service.
func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// ListActivePlans returns the public plan catalog.
func (s *Service) ListActivePlans(ctx context.Context) ([]Plan, error) {
	return s.repo.ActivePlans(ctx)
}

// PlanByCode returns a single plan.
func (s *Service) PlanByCode(ctx context.Context, code string) (*Plan, error) {
	return s.repo.PlanByCode(ctx, code)
}

// CurrentSubscription returns the user's current subscription with its plan.
func (s *Service) CurrentSubscription(ctx context.Context, userID uuid.UUID) (*Subscription, *Plan, error) {
	sub, err := s.repo.CurrentSubscription(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	var plan Plan
	if err := s.repo.DB().Where("id = ?", sub.PlanID).First(&plan).Error; err != nil {
		return nil, nil, err
	}
	return sub, &plan, nil
}

// EnsureFreeSubscription assigns the FREE plan to a new user.
func (s *Service) EnsureFreeSubscription(ctx context.Context, userID uuid.UUID) error {
	plan, err := s.repo.PlanByCode(ctx, PlanFREE)
	if err != nil {
		return err
	}
	return s.assignPlan(ctx, userID, plan, SubActive)
}

// ChangeSubscription simulates a plan change for MVP purposes. It closes the
// current subscription and opens a new one on the target plan.
func (s *Service) ChangeSubscription(ctx context.Context, userID uuid.UUID, planCode string) (*Subscription, error) {
	plan, err := s.repo.PlanByCode(ctx, planCode)
	if err != nil {
		return nil, err
	}
	if !plan.IsActive {
		return nil, response.NewError(400, "PLAN_INACTIVE", "This plan is not currently available")
	}
	sub, err := s.repo.CurrentSubscription(ctx, userID)
	if err != nil {
		sub = nil
	}
	if sub != nil && sub.PlanID == plan.ID {
		return sub, nil
	}
	if err := s.assignPlan(ctx, userID, plan, SubActive); err != nil {
		return nil, err
	}
	return s.repo.CurrentSubscription(ctx, userID)
}

func (s *Service) assignPlan(ctx context.Context, userID uuid.UUID, plan *Plan, status string) error {
	return s.repo.DB().WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		expires := now.AddDate(0, 1, 0)
		if plan.BillingInterval == "YEARLY" {
			expires = now.AddDate(1, 0, 0)
		}
		sub := Subscription{
			UserID:    userID,
			PlanID:    plan.ID,
			Status:    status,
			StartedAt: now,
			ExpiresAt: &expires,
			IsCurrent: true,
		}
		if status == SubCancelled || status == SubExpired {
			sub.ExpiresAt = &now
		}
		if err := tx.Model(&Subscription{}).
			Where("user_id = ?", userID).
			Update("is_current", false).Error; err != nil {
			return err
		}
		return tx.Create(&sub).Error
	})
}

// RecordUsage adjusts a usage counter and appends an audit-friendly event.
func (s *Service) RecordUsage(ctx context.Context, userID uuid.UUID, resourceType string, delta int64, entityID *uuid.UUID, meta map[string]any) error {
	value, err := s.repo.UpsertMetric(ctx, userID, resourceType, delta)
	if err != nil {
		return err
	}
	_ = value
	return s.repo.AppendUsageRecord(ctx, &UsageRecord{
		UserID:       userID,
		ResourceType: resourceType,
		Delta:        delta,
		EntityID:     entityID,
		Metadata:     toJSON(meta),
	})
}

// UsageSnapshot returns current counters for a user.
func (s *Service) UsageSnapshot(ctx context.Context, userID uuid.UUID) (map[string]int64, error) {
	out := map[string]int64{
		MetricPropertyCount:      0,
		MetricActiveTenancyCount: 0,
		MetricStorageBytes:       0,
	}
	for _, key := range []string{MetricPropertyCount, MetricActiveTenancyCount, MetricStorageBytes} {
		v, err := s.repo.Metric(ctx, userID, key)
		if err != nil {
			return nil, err
		}
		out[key] = v
	}
	return out, nil
}
