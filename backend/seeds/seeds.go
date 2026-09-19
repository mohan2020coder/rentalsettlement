package seeds

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"rental-settlement/backend/internal/billing"
)

// planID derives a stable UUID from a plan code so seeding is deterministic.
func planID(code string) uuid.UUID {
	return uuid.NewSHA1(uuid.NameSpaceURL, []byte("plan:"+code))
}

// SeedPlans idempotently inserts the product catalog. Plans are configuration
// stored in the database and can be edited by administrators directly.
func SeedPlans(ctx context.Context, db *gorm.DB) error {
	plans := []billing.Plan{
		{
			ID:                 planID(billing.PlanFREE),
			Code:               billing.PlanFREE,
			Name:               "Free",
			Description:        "For individual landlords evaluating the platform. 1 property, 1 active tenancy, basic inspections and a basic settlement record.",
			PriceMinor:         0,
			Currency:           "INR",
			BillingInterval:    "MONTHLY",
			MaxProperties:      1,
			MaxActiveTenancies: 1,
			MaxStorageMB:       100,
			Features: datatypes.JSON([]byte(`{
				"BASIC_INSPECTION": true,
				"BASIC_MAINTENANCE": true,
				"BASIC_SETTLEMENT": true,
				"EVIDENCE_PACKAGE": true,
				"NOTIFICATIONS": true,
				"ADVANCED_REPORTS": false,
				"AUDIT_HISTORY": false,
				"TEAM_ACCESS": false
			}`)),
			IsActive: true,
		},
		{
			ID:                 planID(billing.PlanLandlord),
			Code:               billing.PlanLandlord,
			Name:               "Landlord",
			Description:        "Multiple properties and tenancies, complete inspection/maintenance history, deduction management, dispute workflow, settlement reports and evidence storage.",
			PriceMinor:         49900,
			Currency:           "INR",
			BillingInterval:    "MONTHLY",
			MaxProperties:      10,
			MaxActiveTenancies: 10,
			MaxStorageMB:       5000,
			Features: datatypes.JSON([]byte(`{
				"BASIC_INSPECTION": true,
				"BASIC_MAINTENANCE": true,
				"BASIC_SETTLEMENT": true,
				"EVIDENCE_PACKAGE": true,
				"NOTIFICATIONS": true,
				"ADVANCED_REPORTS": true,
				"AUDIT_HISTORY": true,
				"TEAM_ACCESS": false
			}`)),
			IsActive: true,
		},
		{
			ID:                 planID(billing.PlanPropertyManager),
			Code:               billing.PlanPropertyManager,
			Name:               "Property Manager",
			Description:        "Portfolio dashboard, staff and team access, larger tenancy limits, advanced reports and full audit history.",
			PriceMinor:         149900,
			Currency:           "INR",
			BillingInterval:    "MONTHLY",
			MaxProperties:      50,
			MaxActiveTenancies: 50,
			MaxStorageMB:       20000,
			Features: datatypes.JSON([]byte(`{
				"BASIC_INSPECTION": true,
				"BASIC_MAINTENANCE": true,
				"BASIC_SETTLEMENT": true,
				"EVIDENCE_PACKAGE": true,
				"NOTIFICATIONS": true,
				"ADVANCED_REPORTS": true,
				"AUDIT_HISTORY": true,
				"TEAM_ACCESS": true
			}`)),
			IsActive: true,
		},
	}

	for i := range plans {
		var count int64
		if err := db.WithContext(ctx).Model(&billing.Plan{}).Where("code = ?", plans[i].Code).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			// Keep the "free" registration working: ensure latest constants.
			if err := db.WithContext(ctx).Model(&billing.Plan{}).
				Where("code = ?", plans[i].Code).
				Updates(map[string]any{
					"is_active": true,
				}).Error; err != nil {
				return err
			}
			continue
		}
		plan := plans[i]
		if err := db.WithContext(ctx).Create(&plan).Error; err != nil {
			return err
		}
	}
	return nil
}
