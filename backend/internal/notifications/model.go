package notifications

import (
	"time"

	"github.com/google/uuid"
)

// Notification is an in-platform notification delivered to a user.
type Notification struct {
	ID         uuid.UUID  `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	UserID     uuid.UUID  `gorm:"column:user_id;type:uuid" json:"user_id"`
	Type       string     `json:"type"`
	Title      string     `json:"title"`
	Body       string     `json:"body"`
	EntityType string     `gorm:"column:entity_type" json:"entity_type"`
	EntityID   *uuid.UUID `gorm:"column:entity_id;type:uuid" json:"entity_id"`
	IsRead     bool       `gorm:"column:is_read" json:"is_read"`
	ReadAt     *time.Time `gorm:"column:read_at" json:"read_at"`
	CreatedAt  time.Time  `json:"created_at"`
}

func (Notification) TableName() string { return "notifications" }
