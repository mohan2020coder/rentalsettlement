package audit

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Actions are audit event names. The list is deliberately wide: audit records
// are how the platform documents "everything before there is a dispute".
const (
	ActionUserRegistered      = "USER_REGISTERED"
	ActionUserLoggedIn        = "USER_LOGGED_IN"
	ActionUserLoggedOut       = "USER_LOGGED_OUT"
	ActionTokenRefreshed      = "TOKEN_REFRESHED"
	ActionPropertyCreated     = "PROPERTY_CREATED"
	ActionPropertyUpdated     = "PROPERTY_UPDATED"
	ActionTenancyCreated      = "TENANCY_CREATED"
	ActionTenancyInvited      = "TENANCY_INVITED"
	ActionTenancyAccepted     = "TENANCY_ACCEPTED"
	ActionTenancyMoveOut      = "MOVE_OUT_STARTED"
	ActionTenancyCancelled    = "TENANCY_CANCELLED"
	ActionAgreementCreated    = "AGREEMENT_CREATED"
	ActionAgreementConfirmed  = "AGREEMENT_CONFIRMED"
	ActionInspectionCreated   = "INSPECTION_CREATED"
	ActionInspectionItemSaved = "INSPECTION_ITEM_SAVED"
	ActionMediaUploaded       = "MEDIA_UPLOADED"
	ActionInspectionConfirmed = "INSPECTION_CONFIRMED"
	ActionMaintenanceCreated  = "MAINTENANCE_CREATED"
	ActionMaintenanceStatus   = "MAINTENANCE_STATUS_CHANGED"
	ActionMaintenanceResolved = "MAINTENANCE_RESOLVED"
	ActionDeductionCreated    = "DEDUCTION_CREATED"
	ActionDisputeOpened       = "DEDUCTION_DISPUTED"
	ActionCounterOfferCreated = "COUNTER_OFFER_CREATED"
	ActionClaimAccepted       = "DEDUCTION_ACCEPTED"
	ActionClaimWithdrawn      = "DEDUCTION_WITHDRAWN"
	ActionSettlementGenerated = "SETTLEMENT_GENERATED"
	ActionSettlementConfirmed = "SETTLEMENT_CONFIRMED"
	ActionSubscriptionCreated = "SUBSCRIPTION_CREATED"
	ActionPlanChanged         = "PLAN_CHANGED"
	ActionEvidenceDownloaded  = "EVIDENCE_DOWNLOADED"
)

// AuditLog is an append-only record of an important action.
type AuditLog struct {
	ID         uuid.UUID      `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	ActorID    *uuid.UUID     `gorm:"column:actor_id;type:uuid" json:"actor_id"`
	TenancyID  *uuid.UUID     `gorm:"column:tenancy_id;type:uuid" json:"tenancy_id"`
	Action     string         `json:"action"`
	EntityType string         `json:"entity_type"`
	EntityID   *uuid.UUID     `gorm:"column:entity_id;type:uuid" json:"entity_id"`
	Metadata   datatypes.JSON `gorm:"column:metadata_json;type:jsonb" json:"metadata,omitempty"`
	IPAddress  string         `gorm:"column:ip_address" json:"ip_address"`
	UserAgent  string         `gorm:"column:user_agent" json:"user_agent"`
	CreatedAt  time.Time      `json:"created_at"`
}

func (AuditLog) TableName() string { return "audit_logs" }
