package billing

import (
	"time"

	"github.com/google/uuid"
)

// PlanDTO is the public plan representation.
type PlanDTO struct {
	ID                 uuid.UUID `json:"id"`
	Code               string    `json:"code"`
	Name               string    `json:"name"`
	Description        string    `json:"description"`
	PriceMinor         int64     `json:"price_minor"`
	PriceFormatted     string    `json:"price_formatted"`
	Currency           string    `json:"currency"`
	BillingInterval    string    `json:"billing_interval"`
	MaxProperties      int64     `json:"max_properties"`
	MaxActiveTenancies int64     `json:"max_active_tenancies"`
	MaxStorageMB       int64     `json:"max_storage_mb"`
	Features           any       `json:"features"`
	IsActive           bool      `json:"is_active"`
}

// SubscriptionDTO is the public subscription representation.
type SubscriptionDTO struct {
	ID        uuid.UUID  `json:"id"`
	Plan      PlanDTO    `json:"plan"`
	Status    string     `json:"status"`
	StartedAt time.Time  `json:"started_at"`
	ExpiresAt *time.Time `json:"expires_at"`
	Provider  string     `json:"provider,omitempty"`
	Renewable bool       `json:"renewable"`
}

// UsageDTO is the public usage snapshot.
type UsageDTO struct {
	PropertyCount      int64 `json:"property_count"`
	ActiveTenancyCount int64 `json:"active_tenancy_count"`
	StorageBytes       int64 `json:"storage_bytes"`
}

// ChangePlanRequest is the change plan payload.
type ChangePlanRequest struct {
	PlanCode string `json:"plan_code"`
}
