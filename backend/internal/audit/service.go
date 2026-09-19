package audit

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"rental-settlement/backend/pkg/middleware"
)

// Service records append-only audit events.
type Service struct {
	db *gorm.DB
}

// NewService builds the audit service.
func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// Entry describes an audit record to be written.
type Entry struct {
	ActorID    *uuid.UUID
	TenancyID  *uuid.UUID
	Action     string
	EntityType string
	EntityID   *uuid.UUID
	Metadata   map[string]any
}

// Record writes an audit entry using request metadata from the context.
func (s *Service) Record(ctx context.Context, e Entry) error {
	ip, ua := middleware.ClientMeta(ctx)
	if ip == "" {
		ip = "unknown"
	}
	var meta datatypes.JSON
	if len(e.Metadata) > 0 {
		b, _ := json.Marshal(e.Metadata)
		meta = datatypes.JSON(b)
	}
	log := AuditLog{
		ActorID:    e.ActorID,
		TenancyID:  e.TenancyID,
		Action:     e.Action,
		EntityType: e.EntityType,
		EntityID:   e.EntityID,
		Metadata:   meta,
		IPAddress:  ip,
		UserAgent:  ua,
	}
	return s.db.WithContext(ctx).Create(&log).Error
}

// ListByTenancy returns chronological audit records for a tenancy.
func (s *Service) ListByTenancy(ctx context.Context, tenancyID uuid.UUID) ([]AuditLog, error) {
	var logs []AuditLog
	err := s.db.WithContext(ctx).
		Where("tenancy_id = ?", tenancyID).
		Order("created_at asc").
		Find(&logs).Error
	return logs, err
}

// ListByActor returns chronological audit records for a user.
func (s *Service) ListByActor(ctx context.Context, actorID uuid.UUID, limit int) ([]AuditLog, error) {
	if limit <= 0 {
		limit = 50
	}
	var logs []AuditLog
	err := s.db.WithContext(ctx).
		Where("actor_id = ?", actorID).
		Order("created_at desc").
		Limit(limit).
		Find(&logs).Error
	return logs, err
}
