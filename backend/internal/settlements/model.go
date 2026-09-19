package settlements

import (
	"time"

	"github.com/google/uuid"
)

// Settlement statuses.
const (
	StatusDraft               = "DRAFT"
	StatusPendingConfirmation = "PENDING_CONFIRMATION"
	StatusConfirmed           = "CONFIRMED"
)

// Settlement summarizes agreed deductions against the recorded deposit and the
// resulting refund (or balance due). It is informational: no money moves
// through the platform.
type Settlement struct {
	ID                   uuid.UUID  `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	TenancyID            uuid.UUID  `gorm:"column:tenancy_id;type:uuid" json:"tenancy_id"`
	Status               string     `json:"status"`
	VersionNumber        int        `gorm:"column:version_number" json:"version_number"`
	RecordedDepositMinor int64      `gorm:"column:recorded_deposit_minor" json:"recorded_deposit_minor"`
	TotalDeductionMinor  int64      `gorm:"column:total_deduction_minor" json:"total_deduction_minor"`
	RemainingAmountMinor int64      `gorm:"column:remaining_amount_minor" json:"remaining_amount_minor"`
	Currency             string     `json:"currency"`
	ProposedBy           *uuid.UUID `gorm:"column:proposed_by;type:uuid" json:"proposed_by"`
	LandlordConfirmedAt  *time.Time `gorm:"column:landlord_confirmed_at" json:"landlord_confirmed_at"`
	TenantConfirmedAt    *time.Time `gorm:"column:tenant_confirmed_at" json:"tenant_confirmed_at"`
	ConfirmedAt          *time.Time `gorm:"column:confirmed_at" json:"confirmed_at"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
	Items                []Item     `gorm:"-" json:"items,omitempty"`
	Events               []Event    `gorm:"-" json:"events,omitempty"`
}

func (Settlement) TableName() string { return "settlements" }

// Item is a single line of the settlement linked to an agreed claim.
type Item struct {
	ID               uuid.UUID  `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	SettlementID     uuid.UUID  `gorm:"column:settlement_id;type:uuid" json:"settlement_id"`
	DeductionClaimID *uuid.UUID `gorm:"column:deduction_claim_id;type:uuid" json:"deduction_claim_id"`
	Category         string     `json:"category"`
	Title            string     `json:"title"`
	AmountMinor      int64      `gorm:"column:amount_minor" json:"amount_minor"`
	CreatedAt        time.Time  `json:"created_at"`
}

func (Item) TableName() string { return "settlement_items" }

// Event is a single step of the settlement trail.
type Event struct {
	ID           uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	SettlementID uuid.UUID `gorm:"column:settlement_id;type:uuid" json:"settlement_id"`
	ActorID      uuid.UUID `gorm:"column:actor_id;type:uuid" json:"actor_id"`
	Action       string    `json:"action"`
	AmountMinor  *int64    `gorm:"column:amount_minor" json:"amount_minor"`
	Notes        *string   `json:"notes"`
	CreatedAt    time.Time `json:"created_at"`
}

func (Event) TableName() string { return "settlement_events" }
