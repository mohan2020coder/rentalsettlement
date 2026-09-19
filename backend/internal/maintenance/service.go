package maintenance

import (
	"context"
	"time"

	"github.com/google/uuid"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/billing"
	"rental-settlement/backend/internal/notifications"
	"rental-settlement/backend/internal/tenancies"
	"rental-settlement/backend/pkg/response"
	"rental-settlement/backend/pkg/storage"
)

// Service implements maintenance business rules.
type Service struct {
	repo      *Repository
	tenancies *tenancies.Service
	billing   *billing.Service
	audit     *audit.Service
	notify    *notifications.Service
}

// NewService builds the maintenance service.
func NewService(repo *Repository, tenancySvc *tenancies.Service, billingSvc *billing.Service, auditSvc *audit.Service, notify *notifications.Service) *Service {
	return &Service{repo: repo, tenancies: tenancySvc, billing: billingSvc, audit: auditSvc, notify: notify}
}

// Report lets any tenancy party open a maintenance request.
func (s *Service) Report(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID, req ReportRequest) (*MaintenanceRequest, error) {
	t, err := s.tenancies.CheckAccess(ctx, userID, tenancyID)
	if err != nil {
		return nil, err
	}
	if req.Title == "" {
		return nil, response.NewError(400, "VALIDATION_ERROR", "title is required")
	}
	now := time.Now().UTC()
	m := &MaintenanceRequest{
		TenancyID:   tenancyID,
		ReportedBy:  userID,
		Title:       req.Title,
		Description: nullableString(req.Description),
		Category:    req.Category,
		Priority:    req.Priority,
		Status:      StatusOpen,
		ReportedAt:  now,
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &tenancyID,
		Action:     audit.ActionMaintenanceCreated,
		EntityType: "maintenance",
		EntityID:   &m.ID,
	})
	_ = s.notify.Notify(ctx, t.LandlordID, notifications.TypeMaintenance, "Maintenance request",
		req.Title, "maintenance", &m.ID)
	return m, nil
}

// Get returns a request if the caller is a tenancy party.
func (s *Service) Get(ctx context.Context, userID uuid.UUID, id uuid.UUID) (*MaintenanceRequest, error) {
	m, err := s.repo.ByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if _, err := s.tenancies.CheckAccess(ctx, userID, m.TenancyID); err != nil {
		return nil, err
	}
	return m, nil
}

// List returns all requests for a tenancy (parties only).
func (s *Service) List(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID) ([]MaintenanceRequest, error) {
	if _, err := s.tenancies.CheckAccess(ctx, userID, tenancyID); err != nil {
		return nil, err
	}
	return s.repo.ListByTenancy(ctx, tenancyID)
}

// UpdateStatus transitions a request. Either party may acknowledge or progress
// it; resolving requires the landlord.
func (s *Service) UpdateStatus(ctx context.Context, userID uuid.UUID, id uuid.UUID, newStatus, comment string) (*MaintenanceRequest, error) {
	m, err := s.Get(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	t, err := s.tenancies.CheckAccess(ctx, userID, m.TenancyID)
	if err != nil {
		return nil, err
	}
	if m.Status == StatusResolved || m.Status == StatusRejected {
		return nil, response.NewError(400, "INVALID_STATE", "This request has already been closed")
	}
	if newStatus == StatusResolved && t.LandlordID != userID {
		return nil, response.NewError(403, "FORBIDDEN", "Only the landlord can resolve a maintenance request")
	}

	previous := m.Status
	if previous == newStatus {
		return nil, response.NewError(400, "INVALID_STATE", "Request already has status "+newStatus)
	}
	now := time.Now().UTC()
	m.Status = newStatus
	if newStatus == StatusResolved {
		m.ResolvedAt = &now
		m.ResolvedBy = &userID
	}
	if err := s.repo.Update(ctx, m); err != nil {
		return nil, err
	}
	_ = s.repo.AppendHistory(ctx, &HistoryEntry{
		MaintenanceRequestID: m.ID,
		PreviousStatus:       previous,
		NewStatus:            newStatus,
		ChangedBy:            userID,
		Comment:              nullableString(comment),
	})

	action := audit.ActionMaintenanceStatus
	if newStatus == StatusResolved {
		action = audit.ActionMaintenanceResolved
	}
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &m.TenancyID,
		Action:     action,
		EntityType: "maintenance",
		EntityID:   &m.ID,
		Metadata:   map[string]any{"new_status": newStatus},
	})
	_ = s.notify.Notify(ctx, t.LandlordID, notifications.TypeMaintenance, "Maintenance status change",
		"Maintenance request is now "+newStatus, "maintenance", &m.ID)
	return m, nil
}

// AddComment appends a comment to the thread.
func (s *Service) AddComment(ctx context.Context, userID uuid.UUID, id uuid.UUID, body string) (*Comment, error) {
	m, err := s.Get(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if body == "" {
		return nil, response.NewError(400, "VALIDATION_ERROR", "body is required")
	}
	c := &Comment{MaintenanceRequestID: m.ID, UserID: userID, Body: body}
	if err := s.repo.AddComment(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

// AddMedia records an attachment for a request, charging STORAGE_BYTES usage.
func (s *Service) AddMedia(ctx context.Context, userID uuid.UUID, id uuid.UUID, req AddMediaRequest) (*Media, error) {
	m, err := s.Get(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if req.FilePath == "" {
		return nil, response.NewError(400, "VALIDATION_ERROR", "file_path is required")
	}
	if err := storage.ValidateKey(req.FilePath); err != nil {
		return nil, response.NewError(400, "VALIDATION_ERROR", "file_path must reference platform storage")
	}
	media := &Media{
		MaintenanceRequestID: m.ID,
		UploadedBy:           userID,
		FilePath:             req.FilePath,
		MimeType:             req.MimeType,
		FileSize:             req.FileSize,
		SHA256Hash:           req.SHA256Hash,
	}
	if err := s.repo.AddMedia(ctx, media); err != nil {
		return nil, err
	}
	_ = s.billing.RecordUsage(ctx, userID, billing.MetricStorageBytes, req.FileSize, &media.ID, nil)
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &m.TenancyID,
		Action:     audit.ActionMediaUploaded,
		EntityType: "media",
		EntityID:   &media.ID,
	})
	return media, nil
}

func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
