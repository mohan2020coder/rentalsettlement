package tenancies

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/billing"
	"rental-settlement/backend/internal/notifications"
	"rental-settlement/backend/internal/properties"
	"rental-settlement/backend/internal/users"
	"rental-settlement/backend/pkg/response"
	"rental-settlement/backend/pkg/validator"
)

// Service implements tenancy business rules.
type Service struct {
	repo         *Repository
	propRepo     *properties.Repository
	userRepo     *users.Repository
	billing      *billing.Service
	entitlements *billing.EntitlementService
	audit        *audit.Service
	notify       *notifications.Service
}

// NewService builds the tenancy service.
func NewService(repo *Repository, propRepo *properties.Repository, userRepo *users.Repository, billingSvc *billing.Service, entitlements *billing.EntitlementService, auditSvc *audit.Service, notify *notifications.Service) *Service {
	return &Service{repo: repo, propRepo: propRepo, userRepo: userRepo, billing: billingSvc, entitlements: entitlements, audit: auditSvc, notify: notify}
}

// Create validates input, resolves the invited tenant's registered account,
// verifies property ownership and plan limit, then creates an INVITED tenancy
// managed entirely in-app.
func (s *Service) Create(ctx context.Context, landlordID uuid.UUID, req CreateTenancyRequest) (*TenancyDTO, error) {
	if details := validateCreate(req); len(details) > 0 {
		return nil, &response.AppError{Status: 400, Code: "VALIDATION_ERROR", Message: "Invalid request", Details: details}
	}

	prop, err := s.propRepo.ByID(ctx, req.PropertyID)
	if err != nil {
		return nil, err
	}
	if prop.LandlordID != landlordID {
		return nil, response.NewError(403, "FORBIDDEN", "You do not own this property")
	}

	invitee, err := s.userRepo.ByEmail(ctx, req.InvitedEmail)
	if err != nil || invitee.Role != users.RoleTenant || invitee.Status != users.StatusActive {
		return nil, response.NewError(400, "INVITEE_NOT_FOUND", "No active tenant account is registered for this email")
	}

	current, err := s.repo.ActiveCountForLandlord(ctx, landlordID)
	if err != nil {
		return nil, err
	}
	if err := s.entitlements.CanCreateTenancy(ctx, landlordID, current); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	email := strings.ToLower(strings.TrimSpace(invitee.Email))
	tenancy := &Tenancy{
		PropertyID:           prop.ID,
		LandlordID:           landlordID,
		TenantID:             &invitee.ID,
		InvitedEmail:         &email,
		InvitedAt:            &now,
		StartDate:            dateTime(req.StartDate),
		EndDate:              dateTime(req.EndDate),
		MonthlyRentMinor:     req.MonthlyRentMinor,
		SecurityDepositMinor: req.SecurityDepositMinor,
		Currency:             defaultCurrency(req.Currency),
		NoticePeriodDays:     req.NoticePeriodDays,
		RentDueDay:           req.RentDueDay,
		AgreementReference:   nullableString(req.AgreementReference),
		Status:               StatusInvited,
	}
	if err := s.repo.Create(ctx, tenancy); err != nil {
		return nil, err
	}

	_ = s.billing.RecordUsage(ctx, landlordID, billing.MetricActiveTenancyCount, 1, &tenancy.ID, nil)
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &landlordID,
		TenancyID:  &tenancy.ID,
		Action:     audit.ActionTenancyCreated,
		EntityType: "tenancy",
		EntityID:   &tenancy.ID,
	})
	_ = s.notify.Notify(ctx, invitee.ID, notifications.TypeInvitation, "New tenancy invitation",
		"Landlord invited you to rent "+prop.PropertyName+". Accept or decline in-app.", "tenancy", &tenancy.ID)

	return toDTO(tenancy), nil
}

// Accept lets the assigned tenant join an INVITED tenancy. No invite token is
// needed: ownership is proven by being the tenant on the tenancy record.
func (s *Service) Accept(ctx context.Context, tenantID uuid.UUID, tenancyID uuid.UUID) (*TenancyDTO, error) {
	user, err := s.userRepo.ByID(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if user.Role != users.RoleTenant {
		return nil, response.NewError(403, "FORBIDDEN", "Only tenants can accept a tenancy invitation")
	}

	t, err := s.repo.ByID(ctx, tenancyID)
	if err != nil {
		return nil, err
	}
	if t.Status != StatusInvited {
		return nil, response.NewError(400, "INVALID_STATE", "This tenancy is not awaiting acceptance")
	}
	if t.TenantID == nil || *t.TenantID != tenantID {
		return nil, response.NewError(403, "FORBIDDEN", "This invitation was issued to another tenant")
	}

	now := time.Now().UTC()
	t.AcceptedAt = &now
	t.Status = StatusActive
	if err := s.repo.Update(ctx, t); err != nil {
		return nil, err
	}

	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &tenantID,
		TenancyID:  &t.ID,
		Action:     audit.ActionTenancyAccepted,
		EntityType: "tenancy",
		EntityID:   &t.ID,
	})
	_ = s.notify.Notify(ctx, t.LandlordID, notifications.TypeInvitation, "Tenancy accepted",
		user.Name+" accepted the tenancy invitation", "tenancy", &t.ID)
	_ = s.notify.Notify(ctx, tenantID, notifications.TypeInvitation, "Invitation accepted",
		"You accepted the tenancy invitation", "tenancy", &t.ID)

	return toDTO(t), nil
}

// Get returns a tenancy if the caller is the landlord or the assigned tenant.
func (s *Service) Get(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID) (*Tenancy, error) {
	t, err := s.repo.ByID(ctx, tenancyID)
	if err != nil {
		return nil, err
	}
	if !t.IsParty(userID) {
		return nil, response.NewError(403, "FORBIDDEN", "You do not have access to this tenancy")
	}
	return t, nil
}

// CheckAccess is a convenience access guard used by other modules.
func (s *Service) CheckAccess(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID) (*Tenancy, error) {
	return s.Get(ctx, userID, tenancyID)
}

// List returns tenancies the user is a party to.
func (s *Service) List(ctx context.Context, userID uuid.UUID) ([]TenancyDTO, error) {
	list, err := s.repo.ListForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]TenancyDTO, 0, len(list))
	for i := range list {
		out = append(out, *toDTO(&list[i]))
	}
	return out, nil
}

// UpdateStatus performs role-aware status transitions.
//
//	NOTICE_GIVEN: tenant initiates a move-out notice from ACTIVE.
//	MOVE_OUT:     landlord or tenant marks move-out departure (from NOTICE_GIVEN or ACTIVE).
//	CANCELLED:    landlord cancels from INVITED/ACTIVE/NOTICE_GIVEN.
//	SETTLED:      either party confirms settlement from MOVE_OUT.
func (s *Service) UpdateStatus(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID, newStatus string) (*TenancyDTO, error) {
	t, err := s.repo.ByID(ctx, tenancyID)
	if err != nil {
		return nil, err
	}
	if !t.IsParty(userID) {
		return nil, response.NewError(403, "FORBIDDEN", "You do not have access to this tenancy")
	}

	occupiedBefore := t.IsOccupying()

	switch newStatus {
	case StatusNoticeGiven:
		if t.TenantID == nil || *t.TenantID != userID {
			return nil, response.NewError(403, "FORBIDDEN", "Only the tenant can give move-out notice")
		}
		if t.Status != StatusActive {
			return nil, response.NewError(400, "INVALID_STATE", "Only an active tenancy can move to NOTICE_GIVEN")
		}
	case StatusMoveOut:
		if t.Status != StatusNoticeGiven && t.Status != StatusActive {
			return nil, response.NewError(400, "INVALID_STATE", "Tenancy must be NOTICE_GIVEN or ACTIVE to move out")
		}
	case StatusCancelled:
		isTenant := t.TenantID != nil && *t.TenantID == userID
		if t.Status != StatusInvited && t.Status != StatusActive && t.Status != StatusNoticeGiven {
			return nil, response.NewError(400, "INVALID_STATE", "This tenancy cannot be cancelled")
		}
		if isTenant && t.Status != StatusInvited {
			return nil, response.NewError(403, "FORBIDDEN", "Only the landlord can cancel an active or ongoing tenancy; the tenant may decline only an invitation")
		}
	case StatusSettled:
		if t.Status != StatusMoveOut {
			return nil, response.NewError(400, "INVALID_STATE", "A settlement can only be recorded after move-out")
		}
	case StatusActive:
		return nil, response.NewError(400, "INVALID_STATE", "Use the invitation accept endpoint to activate a tenancy")
	default:
		return nil, response.NewError(400, "INVALID_STATE", "Unsupported status transition")
	}

	t.Status = newStatus
	if err := s.repo.Update(ctx, t); err != nil {
		return nil, err
	}

	occupiedAfter := t.IsOccupying()
	if occupiedBefore && !occupiedAfter {
		_ = s.billing.RecordUsage(ctx, t.LandlordID, billing.MetricActiveTenancyCount, -1, &t.ID, nil)
	}

	action := audit.ActionTenancyCancelled
	if newStatus == StatusNoticeGiven || newStatus == StatusMoveOut {
		action = audit.ActionTenancyMoveOut
	} else if newStatus == StatusSettled {
		action = audit.ActionSettlementConfirmed
	}
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &t.ID,
		Action:     action,
		EntityType: "tenancy",
		EntityID:   &t.ID,
		Metadata:   map[string]any{"status": newStatus},
	})

	return toDTO(t), nil
}

// IsParty checks whether a user is the landlord or the tenant of a tenancy.
func (t *Tenancy) IsParty(userID uuid.UUID) bool {
	if t.LandlordID == userID {
		return true
	}
	return t.TenantID != nil && *t.TenantID == userID
}

func validateCreate(req CreateTenancyRequest) map[string]any {
	details := map[string]any{}
	if req.PropertyID == uuid.Nil {
		details["property_id"] = "property_id is required"
	}
	if err := validator.Required("invited_email", req.InvitedEmail); err != nil {
		details["invited_email"] = err.Error()
	} else if !validator.IsValidEmail(req.InvitedEmail) {
		details["invited_email"] = "a valid email is required"
	}
	if err := validator.Positive("monthly_rent_minor", req.MonthlyRentMinor); err != nil {
		details["monthly_rent_minor"] = err.Error()
	}
	if err := validator.NonNegative("security_deposit_minor", req.SecurityDepositMinor); err != nil {
		details["security_deposit_minor"] = err.Error()
	}
	if req.Currency == "" {
		details["currency"] = "currency is required"
	}
	if req.RentDueDay != nil && (*req.RentDueDay < 1 || *req.RentDueDay > 31) {
		details["rent_due_day"] = "rent_due_day must be between 1 and 31"
	}
	return details
}

func dateTime(s string) *time.Time {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	parsed, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil
	}
	return &parsed
}

func defaultCurrency(c string) string {
	c = strings.ToUpper(strings.TrimSpace(c))
	if c == "" {
		return "INR"
	}
	return c
}

func nullableString(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}
