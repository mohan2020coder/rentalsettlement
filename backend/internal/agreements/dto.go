package agreements

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/google/uuid"
)

// CreateVersionRequest is the draft-terms payload.
type CreateVersionRequest struct {
	NoticePeriodDays     int      `json:"notice_period_days"`
	MonthlyRentMinor     int64    `json:"monthly_rent_minor"`
	SecurityDepositMinor int64    `json:"security_deposit_minor"`
	Currency             string   `json:"currency"`
	MonthlyPaymentDay    int      `json:"monthly_payment_day"`
	LateFeeMinor         int64    `json:"late_fee_minor"`
	UtilityInclusions    []string `json:"utility_inclusions"`
	Clauses              []string `json:"clauses"`
}

// AgreementVersionDTO is the public agreement representation.
type AgreementVersionDTO struct {
	ID                  uuid.UUID       `json:"id"`
	TenancyID           uuid.UUID       `json:"tenancy_id"`
	VersionNumber       int             `json:"version_number"`
	Terms               json.RawMessage `json:"terms"`
	CreatedBy           uuid.UUID       `json:"created_by"`
	LandlordConfirmedAt *time.Time      `json:"landlord_confirmed_at"`
	TenantConfirmedAt   *time.Time      `json:"tenant_confirmed_at"`
	FullyConfirmed      bool            `json:"fully_confirmed"`
	CreatedAt           time.Time       `json:"created_at"`
}

func toDTO(v *RentalAgreementVersion) *AgreementVersionDTO {
	raw := json.RawMessage(v.TermsJSON)
	return &AgreementVersionDTO{
		ID:                  v.ID,
		TenancyID:           v.TenancyID,
		VersionNumber:       v.VersionNumber,
		Terms:               raw,
		CreatedBy:           v.CreatedBy,
		LandlordConfirmedAt: v.LandlordConfirmedAt,
		TenantConfirmedAt:   v.TenantConfirmedAt,
		FullyConfirmed:      v.IsFullyConfirmed(),
		CreatedAt:           v.CreatedAt,
	}
}

func parseVersion(s string) (int, bool) {
	v, err := strconv.Atoi(s)
	return v, err == nil && v > 0
}
