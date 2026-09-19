package notifications

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"rental-settlement/backend/pkg/response"
)

// Type constants for notification categories.
const (
	TypeInfo        = "INFO"
	TypeInvitation  = "INVITATION"
	TypeInspection  = "INSPECTION"
	TypeMaintenance = "MAINTENANCE"
	TypeDeduction   = "DEDUCTION"
	TypeDispute     = "DISPUTE"
	TypeSettlement  = "SETTLEMENT"
	TypeBilling     = "BILLING"
)

// Service delivers in-platform notifications.
type Service struct {
	db *gorm.DB
}

// NewService builds the notification service.
func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// Notify creates a notification for a user.
func (s *Service) Notify(ctx context.Context, userID uuid.UUID, notifType, title, body, entityType string, entityID *uuid.UUID) error {
	n := Notification{
		UserID:     userID,
		Type:       notifType,
		Title:      title,
		Body:       body,
		EntityType: entityType,
		EntityID:   entityID,
	}
	return s.db.WithContext(ctx).Create(&n).Error
}

// List returns a user's notifications, newest first.
func (s *Service) List(ctx context.Context, userID uuid.UUID, limit int) ([]Notification, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	var ns []Notification
	err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at desc").
		Limit(limit).
		Find(&ns).Error
	return ns, err
}

// MarkRead marks a notification as read, verifying ownership.
func (s *Service) MarkRead(ctx context.Context, userID uuid.UUID, id uuid.UUID) error {
	res := s.db.WithContext(ctx).
		Model(&Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(map[string]any{"is_read": true, "read_at": time.Now().UTC()})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return response.NewError(404, "NOTIFICATION_NOT_FOUND", "Notification not found")
	}
	return nil
}

// MarkAllRead marks all of a user's notifications as read.
func (s *Service) MarkAllRead(ctx context.Context, userID uuid.UUID) error {
	return s.db.WithContext(ctx).
		Model(&Notification{}).
		Where("user_id = ? AND is_read = false", userID).
		Updates(map[string]any{"is_read": true, "read_at": time.Now().UTC()}).Error
}

// UnreadCount returns the number of unread notifications.
func (s *Service) UnreadCount(ctx context.Context, userID uuid.UUID) (int64, error) {
	var count int64
	err := s.db.WithContext(ctx).
		Model(&Notification{}).
		Where("user_id = ? AND is_read = false", userID).
		Count(&count).Error
	return count, err
}
