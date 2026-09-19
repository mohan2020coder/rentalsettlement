package billing

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Plan codes.
const (
	PlanFREE            = "FREE"
	PlanLandlord        = "LANDLORD"
	PlanPropertyManager = "PROPERTY_MANAGER"
)

// Subscription statuses.
const (
	SubTrial     = "TRIAL"
	SubActive    = "ACTIVE"
	SubPastDue   = "PAST_DUE"
	SubCancelled = "CANCELLED"
	SubExpired   = "EXPIRED"
)

// Usage metric resource types.
const (
	MetricPropertyCount      = "PROPERTY_COUNT"
	MetricActiveTenancyCount = "ACTIVE_TENANCY_COUNT"
	MetricStorageBytes       = "STORAGE_BYTES"
)

// Plan defines a purchasable product tier with feature flags and usage limits.
// Plans are configuration stored in the database; changing a plan does not
// require a code release.
type Plan struct {
	ID                 uuid.UUID      `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Code               string         `json:"code"`
	Name               string         `json:"name"`
	Description        string         `json:"description"`
	PriceMinor         int64          `gorm:"column:price_minor" json:"price_minor"`
	Currency           string         `json:"currency"`
	BillingInterval    string         `gorm:"column:billing_interval" json:"billing_interval"`
	MaxProperties      int64          `gorm:"column:max_properties" json:"max_properties"`
	MaxActiveTenancies int64          `gorm:"column:max_active_tenancies" json:"max_active_tenancies"`
	MaxStorageMB       int64          `gorm:"column:max_storage_mb" json:"max_storage_mb"`
	Features           datatypes.JSON `gorm:"column:features_json;type:jsonb" json:"features"`
	IsActive           bool           `gorm:"column:is_active" json:"is_active"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
}

func (Plan) TableName() string { return "plans" }

// Subscription links a user to a plan. Provider fields stay NULL until a real
// payment provider is integrated.
type Subscription struct {
	ID                     uuid.UUID  `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	UserID                 uuid.UUID  `gorm:"column:user_id;type:uuid" json:"user_id"`
	PlanID                 uuid.UUID  `gorm:"column:plan_id;type:uuid" json:"plan_id"`
	Status                 string     `json:"status"`
	StartedAt              time.Time  `gorm:"column:started_at" json:"started_at"`
	ExpiresAt              *time.Time `gorm:"column:expires_at" json:"expires_at"`
	Provider               string     `json:"provider"`
	ProviderCustomerID     string     `gorm:"column:provider_customer_id" json:"provider_customer_id"`
	ProviderSubscriptionID string     `gorm:"column:provider_subscription_id" json:"provider_subscription_id"`
	IsCurrent              bool       `gorm:"column:is_current" json:"-"`
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
}

func (Subscription) TableName() string { return "subscriptions" }

// UsageMetric stores the current cumulative value of a usage counter per user.
type UsageMetric struct {
	ID           uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"-"`
	UserID       uuid.UUID `gorm:"column:user_id;type:uuid" json:"user_id"`
	ResourceType string    `gorm:"column:resource_type" json:"resource_type"`
	CurrentValue int64     `gorm:"column:current_value" json:"current_value"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (UsageMetric) TableName() string { return "usage_metrics" }

// UsageRecord is an append-only event describing a usage delta. Retained for
// audit purposes.
type UsageRecord struct {
	ID           uuid.UUID      `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"-"`
	UserID       uuid.UUID      `gorm:"column:user_id;type:uuid" json:"user_id"`
	ResourceType string         `gorm:"column:resource_type" json:"resource_type"`
	Delta        int64          `json:"delta"`
	EntityID     *uuid.UUID     `gorm:"column:entity_id;type:uuid" json:"entity_id"`
	Metadata     datatypes.JSON `gorm:"column:metadata;type:jsonb" json:"metadata"`
	CreatedAt    time.Time      `json:"created_at"`
}

func (UsageRecord) TableName() string { return "usage_records" }
