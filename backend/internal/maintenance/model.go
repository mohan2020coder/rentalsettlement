package maintenance

import (
	"time"

	"github.com/google/uuid"
)

// Categories, priorities and statuses.
const (
	CatPlumbing   = "PLUMBING"
	CatElectrical = "ELECTRICAL"
	CatAppliance  = "APPLIANCE"
	CatStructural = "STRUCTURAL"
	CatCleaning   = "CLEANING"
	CatOther      = "OTHER"

	PriorityLow    = "LOW"
	PriorityMedium = "MEDIUM"
	PriorityHigh   = "HIGH"
	PriorityUrgent = "URGENT"

	StatusOpen         = "OPEN"
	StatusAcknowledged = "ACKNOWLEDGED"
	StatusInProgress   = "IN_PROGRESS"
	StatusResolved     = "RESOLVED"
	StatusRejected     = "REJECTED"
)

// MaintenanceRequest tracks a reported issue during a tenancy.
type MaintenanceRequest struct {
	ID          uuid.UUID  `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	TenancyID   uuid.UUID  `gorm:"column:tenancy_id;type:uuid" json:"tenancy_id"`
	ReportedBy  uuid.UUID  `gorm:"column:reported_by;type:uuid" json:"reported_by"`
	Title       string     `json:"title"`
	Description *string    `json:"description"`
	Category    string     `json:"category"`
	Priority    string     `json:"priority"`
	Status      string     `json:"status"`
	ReportedAt  time.Time  `json:"reported_at"`
	ResolvedAt  *time.Time `gorm:"column:resolved_at" json:"resolved_at"`
	ResolvedBy  *uuid.UUID `gorm:"column:resolved_by;type:uuid" json:"resolved_by"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	Media       []Media    `gorm:"-" json:"media,omitempty"`
}

func (MaintenanceRequest) TableName() string { return "maintenance_requests" }

// HistoryEntry records a status transition.
type HistoryEntry struct {
	ID                   uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	MaintenanceRequestID uuid.UUID `gorm:"column:maintenance_request_id;type:uuid" json:"maintenance_request_id"`
	PreviousStatus       string    `gorm:"column:previous_status" json:"previous_status"`
	NewStatus            string    `gorm:"column:new_status" json:"new_status"`
	ChangedBy            uuid.UUID `gorm:"column:changed_by;type:uuid" json:"changed_by"`
	Comment              *string   `json:"comment"`
	CreatedAt            time.Time `json:"created_at"`
}

func (HistoryEntry) TableName() string { return "maintenance_history" }

// Comment is a free-text thread entry on a request.
type Comment struct {
	ID                   uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	MaintenanceRequestID uuid.UUID `gorm:"column:maintenance_request_id;type:uuid" json:"maintenance_request_id"`
	UserID               uuid.UUID `gorm:"column:user_id;type:uuid" json:"user_id"`
	Body                 string    `json:"body"`
	CreatedAt            time.Time `json:"created_at"`
}

func (Comment) TableName() string { return "maintenance_comments" }

// Media is an attachment on a maintenance request.
type Media struct {
	ID                   uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	MaintenanceRequestID uuid.UUID `gorm:"column:maintenance_request_id;type:uuid" json:"maintenance_request_id"`
	UploadedBy           uuid.UUID `gorm:"column:uploaded_by;type:uuid" json:"uploaded_by"`
	FilePath             string    `gorm:"column:file_path" json:"file_path"`
	MimeType             string    `gorm:"column:mime_type" json:"mime_type"`
	FileSize             int64     `gorm:"column:file_size" json:"file_size"`
	SHA256Hash           string    `gorm:"column:sha256_hash" json:"sha256_hash"`
	UploadedAt           time.Time `json:"uploaded_at"`
}

func (Media) TableName() string { return "maintenance_media" }
