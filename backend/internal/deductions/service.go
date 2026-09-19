package deductions

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/notifications"
	"rental-settlement/backend/internal/tenancies"
	"rental-settlement/backend/pkg/response"
)

// Service implements deduction-claim and dispute business rules.
type Service struct {
	repo      *Repository
	tenancies *tenancies.Service
	audit     *audit.Service
	notify    *notifications.Service
}

// NewService builds the deductions service.
func NewService(repo *Repository, tenancySvc *tenancies.Service, auditSvc *audit.Service, notify *notifications.Service) *Service {
	return &Service{repo: repo, tenancies: tenancySvc, audit: auditSvc, notify: notify}
}

// Propose lets the landlord raise a deduction claim during move-out.
func (s *Service) Propose(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID, req ProposeClaimRequest) (*DeductionClaim, error) {
	t, err := s.tenancies.CheckAccess(ctx, userID, tenancyID)
	if err != nil {
		return nil, err
	}
	if t.LandlordID != userID {
		return nil, response.NewError(403, "FORBIDDEN", "Only the landlord can propose a deduction claim")
	}
	if t.Status != "MOVE_OUT" && t.Status != "NOTICE_GIVEN" {
		return nil, response.NewError(400, "INVALID_STATE", "Deduction claims can only be raised after move-out")
	}
	if req.Title == "" {
		return nil, response.NewError(400, "VALIDATION_ERROR", "title is required")
	}
	if req.ClaimedAmountMinor <= 0 {
		return nil, response.NewError(400, "VALIDATION_ERROR", "claimed_amount_minor must be positive")
	}

	claim := &DeductionClaim{
		TenancyID:          tenancyID,
		CreatedBy:          userID,
		Category:           req.Category,
		Title:              req.Title,
		Description:        nullableString(req.Description),
		ClaimedAmountMinor: req.ClaimedAmountMinor,
		Currency:           firstNonEmpty(req.Currency, "INR"),
		Status:             ClaimProposed,
	}
	if err := s.repo.CreateClaim(ctx, claim); err != nil {
		return nil, err
	}
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &tenancyID,
		Action:     audit.ActionDeductionCreated,
		EntityType: "deduction",
		EntityID:   &claim.ID,
	})
	if t.TenantID != nil {
		_ = s.notify.Notify(ctx, *t.TenantID, notifications.TypeDeduction, "Deposit deduction claimed",
			req.Title, "deduction", &claim.ID)
	}
	return claim, nil
}

// List returns claims for a tenancy (parties only).
func (s *Service) List(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID) ([]DeductionClaim, error) {
	if _, err := s.tenancies.CheckAccess(ctx, userID, tenancyID); err != nil {
		return nil, err
	}
	return s.repo.ListClaimsByTenancy(ctx, tenancyID)
}

// Get returns a claim if the caller is a party.
func (s *Service) Get(ctx context.Context, userID uuid.UUID, claimID uuid.UUID) (*DeductionClaim, error) {
	c, err := s.repo.ClaimByID(ctx, claimID)
	if err != nil {
		return nil, err
	}
	if _, err := s.tenancies.CheckAccess(ctx, userID, c.TenancyID); err != nil {
		return nil, err
	}
	return c, nil
}

// Accept lets the tenant accept the full proposed deduction.
func (s *Service) Accept(ctx context.Context, userID uuid.UUID, claimID uuid.UUID) (*DeductionClaim, error) {
	c, err := s.loadForTenant(ctx, userID, claimID)
	if err != nil {
		return nil, err
	}
	if c.Status == ClaimAccepted || c.Status == ClaimAgreed {
		return nil, response.NewError(400, "ALREADY_ACCEPTED", "Claim already accepted")
	}
	if c.Status == ClaimWithdrawn {
		return nil, response.NewError(400, "INVALID_STATE", "Claim was withdrawn")
	}
	c.Status = ClaimAgreed
	if err := s.repo.UpdateClaim(ctx, c); err != nil {
		return nil, err
	}

	// Close any open dispute on this claim.
	if d, err := s.repo.OpenDisputeForClaim(ctx, claimID); err == nil && d != nil && d.Status != DisputeClosed {
		now := time.Now().UTC()
		d.Status = DisputeAgreed
		d.ResolvedAt = &now
		_ = s.repo.UpdateDispute(ctx, d)
		_ = s.appendEvent(ctx, d.ID, userID, "ACCEPT", nil, &c.ClaimedAmountMinor, "", nil)
	}

	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &c.TenancyID,
		Action:     audit.ActionClaimAccepted,
		EntityType: "deduction",
		EntityID:   &c.ID,
	})
	return c, nil
}

// Dispute lets the tenant open structured negotiation on a claim.
func (s *Service) Dispute(ctx context.Context, userID uuid.UUID, claimID uuid.UUID, req DisputeRequest) (*Dispute, error) {
	c, err := s.loadForTenant(ctx, userID, claimID)
	if err != nil {
		return nil, err
	}
	if c.Status != ClaimProposed && c.Status != ClaimDisputed {
		return nil, response.NewError(400, "INVALID_STATE", "Only a proposed claim can be disputed")
	}
	if existing, _ := s.repo.OpenDisputeForClaim(ctx, claimID); existing != nil && existing.Status == DisputeOpen {
		return nil, response.NewError(400, "DISPUTE_EXISTS", "A dispute is already open for this claim")
	}

	c.Status = ClaimDisputed
	if err := s.repo.UpdateClaim(ctx, c); err != nil {
		return nil, err
	}
	d := &Dispute{
		TenancyID:        c.TenancyID,
		DeductionClaimID: c.ID,
		OpenedBy:         userID,
		Category:         nullableString(req.Category),
		Description:      nullableString(req.Reason),
		Status:           DisputeOpen,
	}
	if err := s.repo.CreateDispute(ctx, d); err != nil {
		return nil, err
	}
	_ = s.appendEvent(ctx, d.ID, userID, "DISPUTE", &c.ClaimedAmountMinor, nil, req.Reason, nil)
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &c.TenancyID,
		Action:     audit.ActionDisputeOpened,
		EntityType: "dispute",
		EntityID:   &d.ID,
	})
	return d, nil
}

// Withdraw lets the creator withdraw their claim.
func (s *Service) Withdraw(ctx context.Context, userID uuid.UUID, claimID uuid.UUID, reason string) (*DeductionClaim, error) {
	c, err := s.repo.ClaimByID(ctx, claimID)
	if err != nil {
		return nil, err
	}
	if _, err := s.tenancies.CheckAccess(ctx, userID, c.TenancyID); err != nil {
		return nil, err
	}
	if c.CreatedBy != userID {
		return nil, response.NewError(403, "FORBIDDEN", "Only the claim creator can withdraw it")
	}
	if c.Status == ClaimWithdrawn {
		return nil, response.NewError(400, "ALREADY_WITHDRAWN", "Claim already withdrawn")
	}
	c.Status = ClaimWithdrawn
	if err := s.repo.UpdateClaim(ctx, c); err != nil {
		return nil, err
	}
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &c.TenancyID,
		Action:     audit.ActionClaimWithdrawn,
		EntityType: "deduction",
		EntityID:   &c.ID,
	})
	return c, nil
}

// DisputeList returns disputes for a tenancy.
func (s *Service) DisputeList(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID) ([]Dispute, error) {
	if _, err := s.tenancies.CheckAccess(ctx, userID, tenancyID); err != nil {
		return nil, err
	}
	return s.repo.ListDisputesByTenancy(ctx, tenancyID)
}

// DisputeGet returns a dispute with its event trail.
func (s *Service) DisputeGet(ctx context.Context, userID uuid.UUID, disputeID uuid.UUID) (*Dispute, []DisputeEvent, error) {
	d, err := s.repo.DisputeByID(ctx, disputeID)
	if err != nil {
		return nil, nil, err
	}
	if _, err := s.tenancies.CheckAccess(ctx, userID, d.TenancyID); err != nil {
		return nil, nil, err
	}
	events, err := s.repo.Events(ctx, disputeID)
	if err != nil {
		return nil, nil, err
	}
	return d, events, nil
}

// CounterOffer lets either party propose a revised amount. The claim tracks
// the latest proposed value.
func (s *Service) CounterOffer(ctx context.Context, userID uuid.UUID, disputeID uuid.UUID, req CounterOfferRequest) (*Dispute, error) {
	d, err := s.repo.DisputeByID(ctx, disputeID)
	if err != nil {
		return nil, err
	}
	if _, err := s.tenancies.CheckAccess(ctx, userID, d.TenancyID); err != nil {
		return nil, err
	}
	if d.Status != DisputeOpen && d.Status != DisputeNegotiating {
		return nil, response.NewError(400, "INVALID_STATE", "Dispute is closed for negotiation")
	}
	if req.NewAmountMinor <= 0 {
		return nil, response.NewError(400, "VALIDATION_ERROR", "new_amount_minor must be positive")
	}
	claim, err := s.repo.ClaimByID(ctx, d.DeductionClaimID)
	if err != nil {
		return nil, err
	}
	original := claim.ClaimedAmountMinor
	claim.ClaimedAmountMinor = req.NewAmountMinor
	claim.Status = ClaimCounterOffered
	if err := s.repo.UpdateClaim(ctx, claim); err != nil {
		return nil, err
	}
	d.Status = DisputeNegotiating
	if err := s.repo.UpdateDispute(ctx, d); err != nil {
		return nil, err
	}
	_ = s.appendEvent(ctx, d.ID, userID, "COUNTER_OFFER", &original, &req.NewAmountMinor, req.Reason, nil)
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &d.TenancyID,
		Action:     audit.ActionCounterOfferCreated,
		EntityType: "dispute",
		EntityID:   &d.ID,
		Metadata:   map[string]any{"new_amount_minor": req.NewAmountMinor},
	})
	return d, nil
}

// DisputeAccept resolves the dispute at the latest claim amount (tenant side).
func (s *Service) DisputeAccept(ctx context.Context, userID uuid.UUID, disputeID uuid.UUID) (*DeductionClaim, error) {
	d, err := s.repo.DisputeByID(ctx, disputeID)
	if err != nil {
		return nil, err
	}
	t, err := s.tenancies.CheckAccess(ctx, userID, d.TenancyID)
	if err != nil {
		return nil, err
	}
	if t.TenantID == nil || *t.TenantID != userID {
		return nil, response.NewError(403, "FORBIDDEN", "Only the tenant can accept a claimed deduction")
	}
	claim, err := s.repo.ClaimByID(ctx, d.DeductionClaimID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	claim.Status = ClaimAgreed
	if err := s.repo.UpdateClaim(ctx, claim); err != nil {
		return nil, err
	}
	d.Status = DisputeAgreed
	d.ResolvedAt = &now
	if err := s.repo.UpdateDispute(ctx, d); err != nil {
		return nil, err
	}
	_ = s.appendEvent(ctx, d.ID, userID, "ACCEPT", nil, &claim.ClaimedAmountMinor, "", nil)
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &d.TenancyID,
		Action:     audit.ActionClaimAccepted,
		EntityType: "deduction",
		EntityID:   &claim.ID,
	})
	return claim, nil
}

// DisputeWithdraw closes the negotiation, returning the claim to PROPOSED.
func (s *Service) DisputeWithdraw(ctx context.Context, userID uuid.UUID, disputeID uuid.UUID, reason string) (*Dispute, error) {
	d, err := s.repo.DisputeByID(ctx, disputeID)
	if err != nil {
		return nil, err
	}
	if d.OpenedBy != userID {
		return nil, response.NewError(403, "FORBIDDEN", "Only who opened the dispute can withdraw it")
	}
	now := time.Now().UTC()
	d.Status = DisputeClosed
	d.ResolvedAt = &now
	if err := s.repo.UpdateDispute(ctx, d); err != nil {
		return nil, err
	}
	if claim, err := s.repo.ClaimByID(ctx, d.DeductionClaimID); err == nil && claim.Status == ClaimDisputed {
		claim.Status = ClaimProposed
		_ = s.repo.UpdateClaim(ctx, claim)
	}
	_ = s.appendEvent(ctx, d.ID, userID, "WITHDRAW", nil, nil, reason, nil)
	return d, nil
}

// DisputeEvents returns the negotiation trail (parties only).
func (s *Service) DisputeEvents(ctx context.Context, userID uuid.UUID, disputeID uuid.UUID) ([]DisputeEvent, error) {
	d, err := s.repo.DisputeByID(ctx, disputeID)
	if err != nil {
		return nil, err
	}
	if _, err := s.tenancies.CheckAccess(ctx, userID, d.TenancyID); err != nil {
		return nil, err
	}
	return s.repo.Events(ctx, disputeID)
}

func (s *Service) loadForTenant(ctx context.Context, userID uuid.UUID, claimID uuid.UUID) (*DeductionClaim, error) {
	c, err := s.repo.ClaimByID(ctx, claimID)
	if err != nil {
		return nil, err
	}
	t, err := s.tenancies.CheckAccess(ctx, userID, c.TenancyID)
	if err != nil {
		return nil, err
	}
	if t.TenantID == nil || *t.TenantID != userID {
		return nil, response.NewError(403, "FORBIDDEN", "Only the tenant can perform this action")
	}
	return c, nil
}

func (s *Service) appendEvent(ctx context.Context, disputeID, actorID uuid.UUID, action string, original, newVal *int64, reason string, meta map[string]any) error {
	var metaJSON datatypes.JSON
	if len(meta) > 0 {
		b, _ := json.Marshal(meta)
		metaJSON = datatypes.JSON(b)
	}
	return s.repo.CreateEvent(ctx, &DisputeEvent{
		DisputeID:           disputeID,
		ActorID:             actorID,
		Action:              action,
		OriginalAmountMinor: original,
		NewAmountMinor:      newVal,
		Reason:              nullableString(reason),
		MetadataJSON:        metaJSON,
	})
}

func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
