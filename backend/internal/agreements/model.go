package agreements

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Terms is the structured content of an agreement version.
type Terms struct {
	NoticePeriodDays     int      `json:"notice_period_days"`
	MonthlyRentMinor     int64    `json:"monthly_rent_minor"`
	SecurityDepositMinor int64    `json:"security_deposit_minor"`
	Currency             string   `json:"currency"`
	MonthlyPaymentDay    int      `json:"monthly_payment_day"`
	RentDueDate          string   `json:"rent_due_date,omitempty"`
	LateFeeMinor         int64    `json:"late_fee_minor"`
	UtilityInclusions    []string `json:"utility_inclusions"`
	Clauses              []string `json:"clauses"`
}

// RentalAgreementVersion is an immutable snapshot of the rental terms for a
// tenancy. New versions supersede older ones; each side confirms separately.
type RentalAgreementVersion struct {
	ID                  uuid.UUID      `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	TenancyID           uuid.UUID      `gorm:"column:tenancy_id;type:uuid" json:"tenancy_id"`
	VersionNumber       int            `gorm:"column:version_number" json:"version_number"`
	TermsJSON           datatypes.JSON `gorm:"column:terms_json;type:jsonb" json:"-"`
	CreatedBy           uuid.UUID      `gorm:"column:created_by;type:uuid" json:"created_by"`
	LandlordConfirmedAt *time.Time     `gorm:"column:landlord_confirmed_at" json:"landlord_confirmed_at"`
	TenantConfirmedAt   *time.Time     `gorm:"column:tenant_confirmed_at" json:"tenant_confirmed_at"`
	CreatedAt           time.Time      `json:"created_at"`
}

func (RentalAgreementVersion) TableName() string { return "rental_agreement_versions" }

// IsFullyConfirmed reports whether both parties approved this version.
func (v *RentalAgreementVersion) IsFullyConfirmed() bool {
	return v.LandlordConfirmedAt != nil && v.TenantConfirmedAt != nil
}
