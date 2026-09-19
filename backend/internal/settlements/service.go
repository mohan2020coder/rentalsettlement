package settlements

import (
	"context"
	"time"

	"github.com/google/uuid"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/deductions"
	"rental-settlement/backend/internal/notifications"
	"rental-settlement/backend/internal/tenancies"
	"rental-settlement/backend/pkg/response"
)

// Service implements settlement business rules.
type Service struct {
	repo       *Repository
	tenancies  *tenancies.Service
	deductRepo *deductions.Repository
	audit      *audit.Service
	notify     *notifications.Service
}

// NewService builds the settlement service.
func NewService(repo *Repository, tenancySvc *tenancies.Service, deductRepo *deductions.Repository, auditSvc *audit.Service, notify *notifications.Service) *Service {
	return &Service{repo: repo, tenancies: tenancySvc, audit: auditSvc, notify: notify, deductRepo: deductRepo}
}

// Generate snapshots the agreed deduction claims into a settlement draft.
func (s *Service) Generate(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID, req GenerateRequest) (*Settlement, error) {
	t, err := s.tenancies.CheckAccess(ctx, userID, tenancyID)
	if err != nil {
		return nil, err
	}
	if t.LandlordID != userID {
		return nil, response.NewError(403, "FORBIDDEN", "Only the landlord can generate a settlement")
	}
	if t.Status != "MOVE_OUT" {
		return nil, response.NewError(400, "INVALID_STATE", "A settlement can only be generated after move-out")
	}
	if _, err := s.repo.ByTenancy(ctx, tenancyID); err == nil {
		return nil, response.NewError(400, "SETTLEMENT_EXISTS", "A settlement already exists for this tenancy")
	}

	claims, err := s.deductRepo.ListClaimsByTenancy(ctx, tenancyID)
	if err != nil {
		return nil, err
	}

	deposit := req.RecordedDepositMinor
	if deposit == 0 {
		deposit = t.SecurityDepositMinor
	}
	total := int64(0)
	items := make([]Item, 0)
	for i := range claims {
		if claims[i].Status == deductions.ClaimAgreed || claims[i].Status == deductions.ClaimAccepted {
			total += claims[i].ClaimedAmountMinor
			items = append(items, Item{
				DeductionClaimID: &claims[i].ID,
				Category:         claims[i].Category,
				Title:            claims[i].Title,
				AmountMinor:      claims[i].ClaimedAmountMinor,
			})
		}
	}

	now := time.Now().UTC()
	set := &Settlement{
		TenancyID:            tenancyID,
		Status:               StatusDraft,
		VersionNumber:        1,
		RecordedDepositMinor: deposit,
		TotalDeductionMinor:  total,
		RemainingAmountMinor: deposit - total,
		Currency:             firstNonEmpty(req.Currency, t.Currency),
		ProposedBy:           &userID,
		LandlordConfirmedAt:  &now,
	}
	if err := s.repo.Create(ctx, set); err != nil {
		return nil, err
	}
	for i := range items {
		items[i].SettlementID = set.ID
		if err := s.repo.AddItem(ctx, &items[i]); err != nil {
			return nil, err
		}
	}
	_ = s.repo.AddEvent(ctx, &Event{SettlementID: set.ID, ActorID: userID, Action: "GENERATED", AmountMinor: &total, Notes: stringPtr("Settlement generated from agreed deductions")})

	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &tenancyID,
		Action:     audit.ActionSettlementGenerated,
		EntityType: "settlement",
		EntityID:   &set.ID,
	})
	if t.TenantID != nil {
		_ = s.notify.Notify(ctx, *t.TenantID, notifications.TypeSettlement, "Settlement ready",
			"Your settlement statement is ready for review", "settlement", &set.ID)
	}
	return s.repo.ByTenancy(ctx, tenancyID)
}

// Get returns the settlement for a tenancy (parties only).
func (s *Service) Get(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID) (*Settlement, error) {
	if _, err := s.tenancies.CheckAccess(ctx, userID, tenancyID); err != nil {
		return nil, err
	}
	return s.repo.ByTenancy(ctx, tenancyID)
}

// Confirm records a party's agreement. When both confirm, the settlement and
// tenancy are closed.
func (s *Service) Confirm(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID) (*Settlement, error) {
	t, err := s.tenancies.CheckAccess(ctx, userID, tenancyID)
	if err != nil {
		return nil, err
	}
	set, err := s.repo.ByTenancy(ctx, tenancyID)
	if err != nil {
		return nil, err
	}
	if set.Status == StatusConfirmed {
		return nil, response.NewError(400, "ALREADY_CONFIRMED", "Settlement already confirmed")
	}
	now := time.Now().UTC()
	switch {
	case t.LandlordID == userID:
		if set.LandlordConfirmedAt != nil {
			return nil, response.NewError(400, "ALREADY_CONFIRMED", "Landlord already confirmed")
		}
		set.LandlordConfirmedAt = &now
	case t.TenantID != nil && *t.TenantID == userID:
		if set.TenantConfirmedAt != nil {
			return nil, response.NewError(400, "ALREADY_CONFIRMED", "Tenant already confirmed")
		}
		set.TenantConfirmedAt = &now
	default:
		return nil, response.NewError(403, "FORBIDDEN", "Only the tenancy parties can confirm")
	}

	both := set.LandlordConfirmedAt != nil && set.TenantConfirmedAt != nil
	if both {
		set.Status = StatusConfirmed
		set.ConfirmedAt = &now
	}
	if set.Status == StatusDraft {
		set.Status = StatusPendingConfirmation
	}
	if err := s.repo.Update(ctx, set); err != nil {
		return nil, err
	}

	side := "landlord"
	if userID == *t.TenantID {
		side = "tenant"
	}
	_ = s.repo.AddEvent(ctx, &Event{SettlementID: set.ID, ActorID: userID, Action: "CONFIRM", Notes: stringPtr(side + " confirmed the settlement")})

	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &tenancyID,
		Action:     audit.ActionSettlementConfirmed,
		EntityType: "settlement",
		EntityID:   &set.ID,
	})

	if both {
		_, _ = s.tenancies.UpdateStatus(ctx, t.LandlordID, tenancyID, "SETTLED")
		_ = s.notify.Notify(ctx, otherParty(t, userID), notifications.TypeSettlement, "Settlement agreed",
			"Both parties confirmed the settlement", "settlement", &set.ID)
	}
	return s.repo.ByTenancy(ctx, tenancyID)
}

func otherParty(t *tenancies.Tenancy, userID uuid.UUID) uuid.UUID {
	if t.LandlordID == userID {
		if t.TenantID != nil {
			return *t.TenantID
		}
	}
	return t.LandlordID
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func stringPtr(s string) *string { return &s }
