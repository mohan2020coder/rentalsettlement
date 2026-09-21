package applications

import (
	"time"

	"github.com/google/uuid"
)

// Application statuses.
const (
	StatusPending   = "PENDING"
	StatusApproved  = "APPROVED"
	StatusRejected  = "REJECTED"
	StatusCancelled = "CANCELLED"
)

// Application is a tenant's request against a listed property. Approving one
// creates an in-app tenancy invitation from the landlord to that tenant.
type Application struct {
	ID            uuid.UUID  `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	PropertyID    uuid.UUID  `gorm:"column:property_id;type:uuid" json:"property_id"`
	TenantID      uuid.UUID  `gorm:"column:tenant_id;type:uuid" json:"tenant_id"`
	LandlordID    uuid.UUID  `gorm:"column:landlord_id;type:uuid" json:"landlord_id"`
	Status        string     `json:"status"`
	PreferredDate *time.Time `gorm:"column:preferred_date;type:date" json:"preferred_date"`
	Note          *string    `json:"note"`
	DecidedBy     *uuid.UUID `gorm:"column:decided_by;type:uuid" json:"decided_by"`
	DecidedAt     *time.Time `gorm:"column:decided_at" json:"decided_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// TableName maps the model to the property_applications table.
func (Application) TableName() string { return "property_applications" }
