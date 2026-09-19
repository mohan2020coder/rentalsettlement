package deductions

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Claim categories.
const (
	CategoryUnpaidRent     = "UNPAID_RENT"
	CategoryUtility        = "UTILITY"
	CategoryPropertyDamage = "PROPERTY_DAMAGE"
	CategoryMissingItem    = "MISSING_ITEM"
	CategoryCleaning       = "CLEANING"
	CategoryOther          = "OTHER"
)

// Claim statuses.
const (
	ClaimProposed       = "PROPOSED"
	ClaimAccepted       = "ACCEPTED"
	ClaimDisputed       = "DISPUTED"
	ClaimCounterOffered = "COUNTER_OFFERED"
	ClaimAgreed         = "AGREED"
	ClaimWithdrawn      = "WITHDRAWN"
)

// Dispute statuses.
const (
	DisputeOpen        = "OPEN"
	DisputeNegotiating = "NEGOTIATING"
	DisputeAgreed      = "AGREED"
	DisputeUnresolved  = "UNRESOLVED"
	DisputeClosed      = "CLOSED"
)

// DeductionClaim is a landlord-led claim for a partial deposit or rent
// deduction, proposed against a tenancy. The platform never handles money:
// the agreed amount is informational for an off-platform refund.
type DeductionClaim struct {
	ID                 uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	TenancyID          uuid.UUID `gorm:"column:tenancy_id;type:uuid" json:"tenancy_id"`
	CreatedBy          uuid.UUID `gorm:"column:created_by;type:uuid" json:"created_by"`
	Category           string    `json:"category"`
	Title              string    `json:"title"`
	Description        *string   `json:"description"`
	ClaimedAmountMinor int64     `gorm:"column:claimed_amount_minor" json:"claimed_amount_minor"`
	Currency           string    `json:"currency"`
	Status             string    `json:"status"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (DeductionClaim) TableName() string { return "deduction_claims" }

// Dispute wraps a claim in structured negotiation.
type Dispute struct {
	ID               uuid.UUID  `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	TenancyID        uuid.UUID  `gorm:"column:tenancy_id;type:uuid" json:"tenancy_id"`
	DeductionClaimID uuid.UUID  `gorm:"column:deduction_claim_id;type:uuid" json:"deduction_claim_id"`
	OpenedBy         uuid.UUID  `gorm:"column:opened_by;type:uuid" json:"opened_by"`
	Category         *string    `json:"category"`
	Description      *string    `json:"description"`
	Status           string     `json:"status"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	ResolvedAt       *time.Time `gorm:"column:resolved_at" json:"resolved_at"`
}

func (Dispute) TableName() string { return "disputes" }

// DisputeEvent is an append-only step of the negotiation trail.
type DisputeEvent struct {
	ID                  uuid.UUID      `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	DisputeID           uuid.UUID      `gorm:"column:dispute_id;type:uuid" json:"dispute_id"`
	ActorID             uuid.UUID      `gorm:"column:actor_id;type:uuid" json:"actor_id"`
	Action              string         `json:"action"`
	OriginalAmountMinor *int64         `gorm:"column:original_amount_minor" json:"original_amount_minor"`
	NewAmountMinor      *int64         `gorm:"column:new_amount_minor" json:"new_amount_minor"`
	Reason              *string        `json:"reason"`
	MetadataJSON        datatypes.JSON `gorm:"column:metadata_json;type:jsonb" json:"metadata,omitempty"`
	CreatedAt           time.Time      `json:"created_at"`
}

func (DisputeEvent) TableName() string { return "dispute_events" }
