package tenancies

import (
	"time"

	"github.com/google/uuid"
)

// CreateTenancyRequest is the create tenancy payload. The invited user must be
// an existing registered TENANT account; the platform manages the invitation
// entirely in-app (no external email or pin).
type CreateTenancyRequest struct {
	PropertyID           uuid.UUID `json:"property_id"`
	InvitedEmail         string    `json:"invited_email"`
	StartDate            string    `json:"start_date"`
	EndDate              string    `json:"end_date"`
	MonthlyRentMinor     int64     `json:"monthly_rent_minor"`
	SecurityDepositMinor int64     `json:"security_deposit_minor"`
	Currency             string    `json:"currency"`
	NoticePeriodDays     int       `json:"notice_period_days"`
	RentDueDay           *int      `json:"rent_due_day"`
	AgreementReference   string    `json:"agreement_reference"`
}

// AcceptTenancyRequest is empty: the invite is accepted in-app by the assigned
// tenant, so no secret token is presented.
type AcceptTenancyRequest struct{}

// UpdateStatusRequest is the status transition payload.
type UpdateStatusRequest struct {
	Status string `json:"status"`
}

// TenancyDTO is the public tenancy representation.
type TenancyDTO struct {
	ID                   uuid.UUID  `json:"id"`
	PropertyID           uuid.UUID  `json:"property_id"`
	LandlordID           uuid.UUID  `json:"landlord_id"`
	TenantID             *uuid.UUID `json:"tenant_id"`
	InvitedEmail         *string    `json:"invited_email,omitempty"`
	InvitedAt            *time.Time `json:"invited_at,omitempty"`
	AcceptedAt           *time.Time `json:"accepted_at,omitempty"`
	StartDate            *time.Time `json:"start_date,omitempty"`
	EndDate              *time.Time `json:"end_date,omitempty"`
	MonthlyRentMinor     int64      `json:"monthly_rent_minor"`
	SecurityDepositMinor int64      `json:"security_deposit_minor"`
	Currency             string     `json:"currency"`
	NoticePeriodDays     int        `json:"notice_period_days"`
	RentDueDay           *int       `json:"rent_due_day,omitempty"`
	AgreementReference   *string    `json:"agreement_reference,omitempty"`
	Status               string     `json:"status"`
	CreatedAt            time.Time  `json:"created_at"`
}

func toDTO(t *Tenancy) *TenancyDTO {
	return &TenancyDTO{
		ID:                   t.ID,
		PropertyID:           t.PropertyID,
		LandlordID:           t.LandlordID,
		TenantID:             t.TenantID,
		InvitedEmail:         t.InvitedEmail,
		InvitedAt:            t.InvitedAt,
		AcceptedAt:           t.AcceptedAt,
		StartDate:            t.StartDate,
		EndDate:              t.EndDate,
		MonthlyRentMinor:     t.MonthlyRentMinor,
		SecurityDepositMinor: t.SecurityDepositMinor,
		Currency:             t.Currency,
		NoticePeriodDays:     t.NoticePeriodDays,
		RentDueDay:           t.RentDueDay,
		AgreementReference:   t.AgreementReference,
		Status:               t.Status,
		CreatedAt:            t.CreatedAt,
	}
}
