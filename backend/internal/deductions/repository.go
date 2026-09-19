package deductions

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"rental-settlement/backend/pkg/response"
)

// Repository persists claims, disputes and events.
type Repository struct {
	db *gorm.DB
}

// NewRepository builds the deductions repository.
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// CreateClaim inserts a deduction claim.
func (r *Repository) CreateClaim(ctx context.Context, c *DeductionClaim) error {
	return r.db.WithContext(ctx).Create(c).Error
}

// ClaimByID returns a claim by id.
func (r *Repository) ClaimByID(ctx context.Context, id uuid.UUID) (*DeductionClaim, error) {
	var c DeductionClaim
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&c).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "DEDUCTION_NOT_FOUND", "Deduction claim not found")
		}
		return nil, err
	}
	return &c, nil
}

// ListClaimsByTenancy returns claims for a tenancy, newest first.
func (r *Repository) ListClaimsByTenancy(ctx context.Context, tenancyID uuid.UUID) ([]DeductionClaim, error) {
	var list []DeductionClaim
	err := r.db.WithContext(ctx).
		Where("tenancy_id = ?", tenancyID).
		Order("created_at desc").
		Find(&list).Error
	return list, err
}

// UpdateClaim persists a claim.
func (r *Repository) UpdateClaim(ctx context.Context, c *DeductionClaim) error {
	return r.db.WithContext(ctx).Save(c).Error
}

// CreateDispute inserts a dispute.
func (r *Repository) CreateDispute(ctx context.Context, d *Dispute) error {
	return r.db.WithContext(ctx).Create(d).Error
}

// DisputeByClaim finds the active dispute for a claim.
func (r *Repository) DisputeByClaim(ctx context.Context, claimID uuid.UUID) (*Dispute, error) {
	var d Dispute
	err := r.db.WithContext(ctx).
		Where("deduction_claim_id = ?", claimID).
		Order("created_at desc").
		First(&d).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "DISPUTE_NOT_FOUND", "No dispute found for this claim")
		}
		return nil, err
	}
	return &d, nil
}

// DisputeByID returns a dispute.
func (r *Repository) DisputeByID(ctx context.Context, id uuid.UUID) (*Dispute, error) {
	var d Dispute
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&d).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "DISPUTE_NOT_FOUND", "Dispute not found")
		}
		return nil, err
	}
	return &d, nil
}

// ListDisputesByTenancy returns disputes for a tenancy, newest first.
func (r *Repository) ListDisputesByTenancy(ctx context.Context, tenancyID uuid.UUID) ([]Dispute, error) {
	var list []Dispute
	err := r.db.WithContext(ctx).
		Where("tenancy_id = ?", tenancyID).
		Order("created_at desc").
		Find(&list).Error
	return list, err
}

// UpdateDispute persists a dispute.
func (r *Repository) UpdateDispute(ctx context.Context, d *Dispute) error {
	return r.db.WithContext(ctx).Save(d).Error
}

// OpenDisputeForClaim returns the dispute for a claim or nil.
func (r *Repository) OpenDisputeForClaim(ctx context.Context, claimID uuid.UUID) (*Dispute, error) {
	d, err := r.DisputeByClaim(ctx, claimID)
	if err != nil {
		return nil, nil
	}
	return d, nil
}

// CreateEvent appends a dispute event.
func (r *Repository) CreateEvent(ctx context.Context, e *DisputeEvent) error {
	return r.db.WithContext(ctx).Create(e).Error
}

// Events returns all events for a dispute, chronological.
func (r *Repository) Events(ctx context.Context, disputeID uuid.UUID) ([]DisputeEvent, error) {
	var list []DisputeEvent
	err := r.db.WithContext(ctx).
		Where("dispute_id = ?", disputeID).
		Order("created_at asc").
		Find(&list).Error
	return list, err
}
