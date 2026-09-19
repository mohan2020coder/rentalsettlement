package inspections

import (
	"time"

	"github.com/google/uuid"
)

// Inspection kinds.
const (
	KindMoveIn  = "MOVE_IN"
	KindMoveOut = "MOVE_OUT"
)

// Inspection statuses.
const (
	StatusDraft               = "DRAFT"
	StatusPendingConfirmation = "PENDING_CONFIRMATION"
	StatusConfirmed           = "CONFIRMED"
)

// Item conditions.
const (
	ConditionExcellent  = "EXCELLENT"
	ConditionGood       = "GOOD"
	ConditionFair       = "FAIR"
	ConditionDamaged    = "DAMAGED"
	ConditionNotPresent = "NOT_PRESENT"
)

// Inspection captures the agreed state of a property at move-in or move-out.
type Inspection struct {
	ID          uuid.UUID   `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	TenancyID   uuid.UUID   `gorm:"column:tenancy_id;type:uuid" json:"tenancy_id"`
	Kind        string      `json:"kind"`
	Status      string      `json:"status"`
	ConductedAt *time.Time  `gorm:"column:conducted_at" json:"conducted_at"`
	ConductedBy *uuid.UUID  `gorm:"column:conducted_by;type:uuid" json:"conducted_by"`
	Notes       *string     `json:"notes"`
	CreatedBy   uuid.UUID   `gorm:"column:created_by;type:uuid" json:"created_by"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
	Rooms       []Room      `gorm:"-" json:"rooms,omitempty"`
	Media       []Media     `gorm:"-" json:"media,omitempty"`
	ConfirmedBy []uuid.UUID `gorm:"-" json:"confirmed_by,omitempty"`
}

func (Inspection) TableName() string { return "inspections" }

// Room groups inspection items.
type Room struct {
	ID           uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	InspectionID uuid.UUID `gorm:"column:inspection_id;type:uuid" json:"inspection_id"`
	Name         string    `json:"name"`
	SortOrder    int       `gorm:"column:sort_order" json:"sort_order"`
	CreatedAt    time.Time `json:"created_at"`
	Items        []Item    `gorm:"-" json:"items,omitempty"`
}

func (Room) TableName() string { return "inspection_rooms" }

// Item is a single inspected element.
type Item struct {
	ID        uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	RoomID    uuid.UUID `gorm:"column:room_id;type:uuid" json:"room_id"`
	Name      string    `json:"name"`
	Condition *string   `json:"condition"`
	Notes     *string   `json:"notes"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Item) TableName() string { return "inspection_items" }

// Media is an uploaded photo/video attachment.
type Media struct {
	ID           uuid.UUID  `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	InspectionID uuid.UUID  `gorm:"column:inspection_id;type:uuid" json:"inspection_id"`
	RoomID       *uuid.UUID `gorm:"column:room_id;type:uuid" json:"room_id"`
	ItemID       *uuid.UUID `gorm:"column:item_id;type:uuid" json:"item_id"`
	UploadedBy   uuid.UUID  `gorm:"column:uploaded_by;type:uuid" json:"uploaded_by"`
	FilePath     string     `gorm:"column:file_path" json:"file_path"`
	MimeType     string     `gorm:"column:mime_type" json:"mime_type"`
	FileSize     int64      `gorm:"column:file_size" json:"file_size"`
	SHA256Hash   string     `gorm:"column:sha256_hash" json:"sha256_hash"`
	CapturedAt   *time.Time `gorm:"column:captured_at" json:"captured_at"`
	UploadedAt   time.Time  `json:"uploaded_at"`
}

func (Media) TableName() string { return "inspection_media" }

// Confirmation records one party agreeing to the inspection.
type Confirmation struct {
	ID           uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	InspectionID uuid.UUID `gorm:"column:inspection_id;type:uuid" json:"inspection_id"`
	UserID       uuid.UUID `gorm:"column:user_id;type:uuid" json:"user_id"`
	ConfirmedAt  time.Time `json:"confirmed_at"`
}

func (Confirmation) TableName() string { return "inspection_confirmations" }
