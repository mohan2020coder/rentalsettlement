package maintenance

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"rental-settlement/backend/pkg/response"
)

// Repository persists maintenance data.
type Repository struct {
	db *gorm.DB
}

// NewRepository builds the maintenance repository.
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a maintenance request.
func (r *Repository) Create(ctx context.Context, m *MaintenanceRequest) error {
	return r.db.WithContext(ctx).Create(m).Error
}

// ByID returns a request with its media attachments.
func (r *Repository) ByID(ctx context.Context, id uuid.UUID) (*MaintenanceRequest, error) {
	var m MaintenanceRequest
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "MAINTENANCE_NOT_FOUND", "Maintenance request not found")
		}
		return nil, err
	}
	if err := r.db.WithContext(ctx).
		Where("maintenance_request_id = ?", id).
		Order("uploaded_at asc").
		Find(&m.Media).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

// ListByTenancy returns requests for a tenancy, newest first.
func (r *Repository) ListByTenancy(ctx context.Context, tenancyID uuid.UUID) ([]MaintenanceRequest, error) {
	var list []MaintenanceRequest
	err := r.db.WithContext(ctx).
		Where("tenancy_id = ?", tenancyID).
		Order("reported_at desc").
		Find(&list).Error
	return list, err
}

// Update persists a maintenance request.
func (r *Repository) Update(ctx context.Context, m *MaintenanceRequest) error {
	return r.db.WithContext(ctx).Save(m).Error
}

// AppendHistory appends a status-transition record.
func (r *Repository) AppendHistory(ctx context.Context, h *HistoryEntry) error {
	return r.db.WithContext(ctx).Create(h).Error
}

// AddComment appends a comment.
func (r *Repository) AddComment(ctx context.Context, c *Comment) error {
	return r.db.WithContext(ctx).Create(c).Error
}

// Comments returns the comment thread, oldest first.
func (r *Repository) Comments(ctx context.Context, requestID uuid.UUID) ([]Comment, error) {
	var list []Comment
	err := r.db.WithContext(ctx).
		Where("maintenance_request_id = ?", requestID).
		Order("created_at asc").
		Find(&list).Error
	return list, err
}

// History returns the transition trail, oldest first.
func (r *Repository) History(ctx context.Context, requestID uuid.UUID) ([]HistoryEntry, error) {
	var list []HistoryEntry
	err := r.db.WithContext(ctx).
		Where("maintenance_request_id = ?", requestID).
		Order("created_at asc").
		Find(&list).Error
	return list, err
}

// AddMedia inserts a maintenance media attachment.
func (r *Repository) AddMedia(ctx context.Context, m *Media) error {
	return r.db.WithContext(ctx).Create(m).Error
}
