package billing

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"gorm.io/datatypes"

	"rental-settlement/backend/pkg/response"
)

// EntitlementService centralizes plan-limit and feature checks so domain
// modules never compare plan codes directly.
type EntitlementService struct {
	repo *Repository
}

// NewEntitlementService builds the entitlement service.
func NewEntitlementService(repo *Repository) *EntitlementService {
	return &EntitlementService{repo: repo}
}

// ErrPlanLimitReached is returned when a plan cap is exceeded.
var ErrPlanLimitReached = response.NewError(403, "PLAN_LIMIT_REACHED", "Your current plan limit has been reached")

// ErrFeatureUnavailable is returned when a plan does not allow a feature.
var ErrFeatureUnavailable = response.NewError(403, "FEATURE_NOT_AVAILABLE", "Your current plan does not include this feature")

func (e *EntitlementService) currentPlan(ctx context.Context, userID uuid.UUID) (*Plan, error) {
	sub, err := e.repo.CurrentSubscription(ctx, userID)
	if err != nil {
		return nil, err
	}
	var plan Plan
	if err := e.repo.DB().Where("id = ?", sub.PlanID).First(&plan).Error; err != nil {
		return nil, err
	}
	return &plan, nil
}

// CanCreateProperty verifies the property count limit for a user.
func (e *EntitlementService) CanCreateProperty(ctx context.Context, userID uuid.UUID, currentCount int64) error {
	plan, err := e.currentPlan(ctx, userID)
	if err != nil {
		return err
	}
	return checkLimit(plan.MaxProperties, currentCount)
}

// CanCreateTenancy verifies the active tenancy count limit for a user.
func (e *EntitlementService) CanCreateTenancy(ctx context.Context, userID uuid.UUID, activeCount int64) error {
	plan, err := e.currentPlan(ctx, userID)
	if err != nil {
		return err
	}
	return checkLimit(plan.MaxActiveTenancies, activeCount)
}

// CanUploadStorage verifies the storage allowance for a user. currentBytes is
// the amount already stored; newBytes is the size of the incoming upload.
func (e *EntitlementService) CanUploadStorage(ctx context.Context, userID uuid.UUID, currentBytes int64, newBytes int64) error {
	plan, err := e.currentPlan(ctx, userID)
	if err != nil {
		return err
	}
	limitBytes := plan.MaxStorageMB * 1024 * 1024
	if plan.MaxStorageMB < 0 {
		return nil
	}
	if currentBytes+newBytes > limitBytes {
		return ErrPlanLimitReached
	}
	return nil
}

// HasFeature reports whether the user's current plan enables a feature flag.
func (e *EntitlementService) HasFeature(ctx context.Context, userID uuid.UUID, feature string) (bool, error) {
	plan, err := e.currentPlan(ctx, userID)
	if err != nil {
		return false, err
	}
	var features map[string]any
	if len(plan.Features) > 0 {
		if err := json.Unmarshal(plan.Features, &features); err != nil {
			return false, err
		}
	}
	v, ok := features[feature]
	if !ok {
		return false, nil
	}
	b, ok := v.(bool)
	if !ok {
		return false, nil
	}
	return b, nil
}

// RequireFeature returns an error when the feature flag is not enabled.
func (e *EntitlementService) RequireFeature(ctx context.Context, userID uuid.UUID, feature string) error {
	ok, err := e.HasFeature(ctx, userID, feature)
	if err != nil {
		return err
	}
	if !ok {
		return ErrFeatureUnavailable
	}
	return nil
}

// checkLimit enforces a cap. -1 means unlimited.
func checkLimit(limit int64, current int64) error {
	if limit < 0 {
		return nil
	}
	if current >= limit {
		return ErrPlanLimitReached
	}
	return nil
}

func toJSON(m map[string]any) datatypes.JSON {
	if len(m) == 0 {
		return nil
	}
	b, _ := json.Marshal(m)
	return datatypes.JSON(b)
}
