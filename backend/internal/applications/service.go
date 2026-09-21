package applications

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"rental-settlement/backend/internal/agreements"
	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/notifications"
	"rental-settlement/backend/internal/properties"
	"rental-settlement/backend/internal/tenancies"
	"rental-settlement/backend/internal/users"
	"rental-settlement/backend/pkg/response"
	"rental-settlement/backend/pkg/validator"
)

// Service implements the visit-request flow between tenants and landlords.
type Service struct {
	repo       *Repository
	propRepo   *properties.Repository
	userRepo   *users.Repository
	tenancies  *tenancies.Service
	agreements *agreements.Service
	audit      *audit.Service
	notify     *notifications.Service
}

// NewService builds the application service.
func NewService(repo *Repository, propRepo *properties.Repository, userRepo *users.Repository, tenancySvc *tenancies.Service, agreementSvc *agreements.Service, auditSvc *audit.Service, notify *notifications.Service) *Service {
	return &Service{repo: repo, propRepo: propRepo, userRepo: userRepo, tenancies: tenancySvc, agreements: agreementSvc, audit: auditSvc, notify: notify}
}

// Create lets a tenant request to visit/rent a listed property.
func (s *Service) Create(ctx context.Context, tenantID uuid.UUID, req CreateRequest) (*ApplicationDTO, error) {
	if req.PropertyID == uuid.Nil {
		return nil, &response.AppError{Status: 400, Code: "VALIDATION_ERROR", Message: "Invalid request", Details: map[string]any{"property_id": "property_id is required"}}
	}
	if err := validator.MaxLen("note", req.Note, 500); err != nil {
		return nil, &response.AppError{Status: 400, Code: "VALIDATION_ERROR", Message: "Invalid request", Details: map[string]any{"note": err.Error()}}
	}

	user, err := s.userRepo.ByID(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if user.Role != users.RoleTenant {
		return nil, response.NewError(403, "FORBIDDEN", "Only tenants can send a request")
	}

	prop, err := s.propRepo.ByID(ctx, req.PropertyID)
	if err != nil {
		return nil, err
	}
	if !prop.Listed || prop.Status != properties.StatusActive {
		return nil, response.NewError(400, "PROPERTY_NOT_LISTED", "This property is not currently accepting requests")
	}

	pending, err := s.repo.ExistsPending(ctx, prop.ID, tenantID)
	if err != nil {
		return nil, err
	}
	if pending {
		return nil, response.NewError(409, "REQUEST_ALREADY_PENDING", "You already have a pending request for this property")
	}

	preferredDate, pErr := parseDate(req.PreferredDate)
	if pErr != nil {
		return nil, &response.AppError{Status: 400, Code: "VALIDATION_ERROR", Message: "Invalid request", Details: map[string]any{"preferred_date": pErr.Error()}}
	}
	note := strings.TrimSpace(req.Note)
	app := &Application{
		PropertyID:    prop.ID,
		TenantID:      tenantID,
		LandlordID:    prop.LandlordID,
		Status:        StatusPending,
		PreferredDate: preferredDate,
		Note:          nullableString(note),
	}
	if err := s.repo.Create(ctx, app); err != nil {
		return nil, err
	}

	_ = s.notify.Notify(ctx, prop.LandlordID, notifications.TypeApplication, "New visit request",
		user.Name+" requested to see "+prop.PropertyName, "application", &app.ID)
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &tenantID,
		Action:     audit.ActionApplicationCreated,
		EntityType: "application",
		EntityID:   &app.ID,
		Metadata:   map[string]any{"property_id": prop.ID.String()},
	})

	return s.toDTO(ctx, app, prop)
}

// List returns the caller's applications: as a tenant their requests, as a
// landlord the requests on their properties.
func (s *Service) List(ctx context.Context, userID uuid.UUID) ([]ApplicationDTO, error) {
	list, err := s.repo.ListForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]ApplicationDTO, 0, len(list))
	for i := range list {
		prop, err := s.propRepo.ByID(ctx, list[i].PropertyID)
		if err != nil {
			continue
		}
		dto, err := s.toDTO(ctx, &list[i], prop)
		if err != nil {
			continue
		}
		out = append(out, *dto)
	}
	return out, nil
}

// Cancel lets the tenant withdraw their own pending request.
func (s *Service) Cancel(ctx context.Context, tenantID uuid.UUID, id uuid.UUID) (*ApplicationDTO, error) {
	a, err := s.repo.ByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if a.TenantID != tenantID {
		return nil, response.NewError(403, "FORBIDDEN", "You do not have access to this request")
	}
	if a.Status != StatusPending {
		return nil, response.NewError(400, "INVALID_STATE", "Only a pending request can be cancelled")
	}
	a.Status = StatusCancelled
	if err := s.repo.Update(ctx, a); err != nil {
		return nil, err
	}
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &tenantID,
		Action:     audit.ActionApplicationCancelled,
		EntityType: "application",
		EntityID:   &a.ID,
	})
	return s.loadDTO(ctx, a)
}

// Approve accepts a request and creates an in-app tenancy invitation for the
// tenant. The property is removed from the catalog once spoken for.
func (s *Service) Approve(ctx context.Context, landlordID uuid.UUID, id uuid.UUID) (*ApplicationDTO, error) {
	a, err := s.repo.ByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if a.LandlordID != landlordID {
		return nil, response.NewError(403, "FORBIDDEN", "You do not have access to this request")
	}
	if a.Status != StatusPending {
		return nil, response.NewError(400, "INVALID_STATE", "Only a pending request can be approved")
	}

	prop, err := s.propRepo.ByID(ctx, a.PropertyID)
	if err != nil {
		return nil, err
	}
	tenant, err := s.userRepo.ByID(ctx, a.TenantID)
	if err != nil {
		return nil, err
	}

	start := ""
	if a.PreferredDate != nil {
		start = a.PreferredDate.Format("2006-01-02")
	}
	invite, err := s.tenancies.Create(ctx, landlordID, tenancies.CreateTenancyRequest{
		PropertyID:           prop.ID,
		InvitedEmail:         tenant.Email,
		StartDate:            start,
		MonthlyRentMinor:     prop.MonthlyRentMinor,
		SecurityDepositMinor: prop.SecurityDepositMinor,
		Currency:             prop.Currency,
		NoticePeriodDays:     30,
		RentDueDay:           intPtr(5),
	})
	if err != nil {
		return nil, err
	}

	// Place the first version of the rental agreement up front with the same
	// terms the tenancy was invited with, so the tenant reviews it alongside
	// the invitation.
	_, _ = s.agreements.CreateVersion(ctx, landlordID, invite.ID, agreements.CreateVersionRequest{
		NoticePeriodDays:     30,
		MonthlyRentMinor:     prop.MonthlyRentMinor,
		SecurityDepositMinor: prop.SecurityDepositMinor,
		Currency:             prop.Currency,
		MonthlyPaymentDay:    5,
	})

	_ = s.propRepo.UnlistByProperty(ctx, prop.ID)
	now := time.Now().UTC()
	a.Status = StatusApproved
	a.DecidedBy = &landlordID
	a.DecidedAt = &now
	if err := s.repo.Update(ctx, a); err != nil {
		return nil, err
	}

	_ = s.notify.Notify(ctx, tenant.ID, notifications.TypeApplication, "Request approved",
		"Your request for "+prop.PropertyName+" was approved. A rental agreement is ready to review — accept the tenancy invitation to continue.", "tenancy", &invite.ID)
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &landlordID,
		Action:     audit.ActionApplicationApproved,
		EntityType: "application",
		EntityID:   &a.ID,
		Metadata:   map[string]any{"tenancy_id": invite.ID.String()},
	})

	return s.loadDTO(ctx, a)
}

// Reject declines a tenant's request.
func (s *Service) Reject(ctx context.Context, landlordID uuid.UUID, id uuid.UUID) (*ApplicationDTO, error) {
	a, err := s.repo.ByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if a.LandlordID != landlordID {
		return nil, response.NewError(403, "FORBIDDEN", "You do not have access to this request")
	}
	if a.Status != StatusPending {
		return nil, response.NewError(400, "INVALID_STATE", "Only a pending request can be rejected")
	}
	prop, err := s.propRepo.ByID(ctx, a.PropertyID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	a.Status = StatusRejected
	a.DecidedBy = &landlordID
	a.DecidedAt = &now
	if err := s.repo.Update(ctx, a); err != nil {
		return nil, err
	}

	_ = s.notify.Notify(ctx, a.TenantID, notifications.TypeApplication, "Request declined",
		"Your request for "+prop.PropertyName+" was declined by the landlord", "application", &a.ID)
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &landlordID,
		Action:     audit.ActionApplicationRejected,
		EntityType: "application",
		EntityID:   &a.ID,
	})

	return s.loadDTO(ctx, a)
}

func (s *Service) loadDTO(ctx context.Context, a *Application) (*ApplicationDTO, error) {
	prop, err := s.propRepo.ByID(ctx, a.PropertyID)
	if err != nil {
		return nil, err
	}
	return s.toDTO(ctx, a, prop)
}

func (s *Service) toDTO(ctx context.Context, a *Application, prop *properties.Property) (*ApplicationDTO, error) {
	tenant, err := s.userRepo.ByID(ctx, a.TenantID)
	if err != nil {
		return nil, err
	}
	landlord, err := s.userRepo.ByID(ctx, a.LandlordID)
	if err != nil {
		return nil, err
	}
	return &ApplicationDTO{
		ID:               a.ID,
		PropertyID:       a.PropertyID,
		PropertyName:     prop.PropertyName,
		Locality:         prop.Locality,
		City:             prop.City,
		MonthlyRentMinor: prop.MonthlyRentMinor,
		Currency:         prop.Currency,
		TenantID:         a.TenantID,
		TenantName:       tenant.Name,
		TenantEmail:      tenant.Email,
		LandlordID:       a.LandlordID,
		LandlordName:     landlord.Name,
		Status:           a.Status,
		PreferredDate:    a.PreferredDate,
		Note:             a.Note,
		CreatedAt:        a.CreatedAt,
	}, nil
}

func parseDate(s string) (*time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, nil
	}
	parsed, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil, fmt.Errorf("preferred_date must be a valid YYYY-MM-DD date")
	}
	return &parsed, nil
}

func nullableString(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

func intPtr(v int) *int { return &v }
