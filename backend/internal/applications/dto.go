package applications

import (
	"time"

	"github.com/google/uuid"
)

// CreateRequest is the create application payload.
type CreateRequest struct {
	PropertyID    uuid.UUID `json:"property_id"`
	PreferredDate string    `json:"preferred_date"`
	Note          string    `json:"note"`
}

// ApplicationDTO is the public application representation, enriched with the
// property summary and the other party's identity.
type ApplicationDTO struct {
	ID               uuid.UUID  `json:"id"`
	PropertyID       uuid.UUID  `json:"property_id"`
	PropertyName     string     `json:"property_name"`
	Locality         *string    `json:"locality"`
	City             *string    `json:"city"`
	MonthlyRentMinor int64      `json:"monthly_rent_minor"`
	Currency         string     `json:"currency"`
	TenantID         uuid.UUID  `json:"tenant_id"`
	TenantName       string     `json:"tenant_name"`
	TenantEmail      string     `json:"tenant_email"`
	LandlordID       uuid.UUID  `json:"landlord_id"`
	LandlordName     string     `json:"landlord_name"`
	Status           string     `json:"status"`
	PreferredDate    *time.Time `json:"preferred_date,omitempty"`
	Note             *string    `json:"note,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
}
