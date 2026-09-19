package tenancies

import (
	"time"

	"github.com/google/uuid"
)

// Tenancy statuses.
const (
	StatusInvited     = "INVITED"
	StatusActive      = "ACTIVE"
	StatusNoticeGiven = "NOTICE_GIVEN"
	StatusMoveOut     = "MOVE_OUT"
	StatusSettled     = "SETTLED"
	StatusCancelled   = "CANCELLED"
)

// Tenancy links a property with a landlord and a tenant, and carries the
// informational rent and deposit terms. The deposit is informational only:
// the platform never holds or transfers it.
type Tenancy struct {
	ID                   uuid.UUID  `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	PropertyID           uuid.UUID  `gorm:"column:property_id;type:uuid" json:"property_id"`
	LandlordID           uuid.UUID  `gorm:"column:landlord_id;type:uuid" json:"landlord_id"`
	TenantID             *uuid.UUID `gorm:"column:tenant_id;type:uuid" json:"tenant_id"`
	InvitedEmail         *string    `gorm:"column:invited_email" json:"invited_email"`
	InviteToken          *string    `gorm:"column:invite_token" json:"-"`
	InvitedAt            *time.Time `gorm:"column:invited_at" json:"invited_at"`
	AcceptedAt           *time.Time `gorm:"column:accepted_at" json:"accepted_at"`
	StartDate            *time.Time `gorm:"column:start_date;type:date" json:"start_date"`
	EndDate              *time.Time `gorm:"column:end_date;type:date" json:"end_date"`
	MonthlyRentMinor     int64      `gorm:"column:monthly_rent_minor" json:"monthly_rent_minor"`
	SecurityDepositMinor int64      `gorm:"column:security_deposit_minor" json:"security_deposit_minor"`
	Currency             string     `json:"currency"`
	NoticePeriodDays     int        `gorm:"column:notice_period_days" json:"notice_period_days"`
	RentDueDay           *int       `gorm:"column:rent_due_day" json:"rent_due_day"`
	AgreementReference   *string    `gorm:"column:agreement_reference" json:"agreement_reference"`
	Status               string     `json:"status"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

func (Tenancy) TableName() string { return "tenancies" }

// IsOccupying reports whether the tenancy counts against the active tenancy
// usage limit.
func (t *Tenancy) IsOccupying() bool {
	switch t.Status {
	case StatusInvited, StatusActive, StatusNoticeGiven, StatusMoveOut:
		return true
	default:
		return false
	}
}
