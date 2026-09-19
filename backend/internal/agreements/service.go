package agreements

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/notifications"
	"rental-settlement/backend/internal/tenancies"
	"rental-settlement/backend/pkg/response"
	"rental-settlement/backend/pkg/validator"
)

// Service implements agreement business rules.
type Service struct {
	repo      *Repository
	tenancies *tenancies.Service
	audit     *audit.Service
	notify    *notifications.Service
}

// NewService builds the agreement service.
func NewService(repo *Repository, tenancySvc *tenancies.Service, auditSvc *audit.Service, notify *notifications.Service) *Service {
	return &Service{repo: repo, tenancies: tenancySvc, audit: auditSvc, notify: notify}
}

// CreateVersion creates the next agreement version. Only the landlord drafts
// terms; the tenant may review and propose changes via dispute negotiation
// (the agreement itself is landlord-authored).
func (s *Service) CreateVersion(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID, req CreateVersionRequest) (*RentalAgreementVersion, error) {
	t, err := s.tenancies.CheckAccess(ctx, userID, tenancyID)
	if err != nil {
		return nil, err
	}
	if t.Status == "CANCELLED" || t.Status == "SETTLED" {
		return nil, response.NewError(400, "INVALID_STATE", "Agreements cannot be created for this tenancy state")
	}

	prev, latestErr := s.repo.Latest(ctx, tenancyID)
	next := 1
	if latestErr == nil {
		next = prev.VersionNumber + 1
	}

	terms, err := termsFromRequest(req)
	if err != nil {
		return nil, &response.AppError{Status: 400, Code: "VALIDATION_ERROR", Message: "Invalid request", Details: map[string]any{"terms": err.Error()}}
	}
	tb, err := json.Marshal(terms)
	if err != nil {
		return nil, err
	}

	version := &RentalAgreementVersion{
		TenancyID:     tenancyID,
		VersionNumber: next,
		TermsJSON:     tb,
		CreatedBy:     userID,
	}
	if err := s.repo.Create(ctx, version); err != nil {
		return nil, err
	}

	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &tenancyID,
		Action:     audit.ActionAgreementCreated,
		EntityType: "agreement",
		EntityID:   &version.ID,
		Metadata:   map[string]any{"version": next},
	})
	_ = s.notify.Notify(ctx, otherPartyID(t, userID), notifications.TypeInfo, "New rental agreement version",
		"A new rental agreement version is ready for your review", "agreement", &version.ID)

	return version, nil
}

// Current returns the latest agreement version.
func (s *Service) Current(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID) (*RentalAgreementVersion, error) {
	if _, err := s.tenancies.CheckAccess(ctx, userID, tenancyID); err != nil {
		return nil, err
	}
	return s.repo.Latest(ctx, tenancyID)
}

// ListVersions returns all agreement versions for a tenancy.
func (s *Service) ListVersions(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID) ([]RentalAgreementVersion, error) {
	if _, err := s.tenancies.CheckAccess(ctx, userID, tenancyID); err != nil {
		return nil, err
	}
	return s.repo.ListVersions(ctx, tenancyID)
}

// Approve marks the caller's side as confirming the current version.
func (s *Service) Approve(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID, versionNumber int) (*RentalAgreementVersion, error) {
	t, err := s.tenancies.CheckAccess(ctx, userID, tenancyID)
	if err != nil {
		return nil, err
	}
	v, err := s.repo.ByVersion(ctx, tenancyID, versionNumber)
	if err != nil {
		return nil, err
	}

	switch {
	case t.LandlordID == userID:
		if v.LandlordConfirmedAt != nil {
			return nil, response.NewError(400, "ALREADY_CONFIRMED", "Landlord already confirmed")
		}
		now := time.Now().UTC()
		v.LandlordConfirmedAt = &now
	case t.TenantID != nil && *t.TenantID == userID:
		if v.TenantConfirmedAt != nil {
			return nil, response.NewError(400, "ALREADY_CONFIRMED", "Tenant already confirmed")
		}
		now := time.Now().UTC()
		v.TenantConfirmedAt = &now
	default:
		return nil, response.NewError(403, "FORBIDDEN", "Only the tenancy parties can confirm")
	}

	if err := s.repo.Update(ctx, v); err != nil {
		return nil, err
	}

	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &tenancyID,
		Action:     audit.ActionAgreementConfirmed,
		EntityType: "agreement",
		EntityID:   &v.ID,
		Metadata:   map[string]any{"version": versionNumber},
	})
	if v.IsFullyConfirmed() {
		_ = s.notify.Notify(ctx, otherPartyID(t, userID), notifications.TypeInfo, "Rental agreement agreed",
			"Both parties confirmed the rental agreement", "agreement", &v.ID)
	}
	return v, nil
}

func termsFromRequest(req CreateVersionRequest) (*Terms, error) {
	terms := &Terms{
		NoticePeriodDays:     req.NoticePeriodDays,
		MonthlyRentMinor:     req.MonthlyRentMinor,
		SecurityDepositMinor: req.SecurityDepositMinor,
		Currency:             req.Currency,
		MonthlyPaymentDay:    req.MonthlyPaymentDay,
		LateFeeMinor:         req.LateFeeMinor,
		UtilityInclusions:    req.UtilityInclusions,
		Clauses:              req.Clauses,
	}
	if terms.MonthlyRentMinor <= 0 {
		return nil, response.NewError(400, "VALIDATION_ERROR", "monthly_rent_minor is required")
	}
	if terms.SecurityDepositMinor < 0 {
		return nil, response.NewError(400, "VALIDATION_ERROR", "security_deposit_minor must be positive")
	}
	if err := validator.Required("currency", terms.Currency); err != nil {
		return nil, err
	}
	return terms, nil
}

func otherPartyID(t *tenancies.Tenancy, userID uuid.UUID) uuid.UUID {
	if t.LandlordID == userID {
		if t.TenantID != nil {
			return *t.TenantID
		}
	}
	return t.LandlordID
}
