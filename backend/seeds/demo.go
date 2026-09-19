package seeds

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"rental-settlement/backend/internal/agreements"
	"rental-settlement/backend/internal/auth"
	"rental-settlement/backend/internal/billing"
	"rental-settlement/backend/internal/inspections"
	"rental-settlement/backend/internal/properties"
	"rental-settlement/backend/internal/tenancies"
	"rental-settlement/backend/internal/users"
)

// Demo credentials. Exported so docs and the mobile app can reference them.
const (
	DemoLandlordEmail = "rajesh@example.in"
	DemoLandlordName  = "Rajesh Kumar"
	DemoTenantEmail   = "arun@example.in"
	DemoTenantName    = "Arun Sharma"
	DemoPassword      = "Demo@1234"
)

func demoID(label string) uuid.UUID {
	return uuid.NewSHA1(uuid.NameSpaceURL, []byte("demo:"+label))
}

// SeedDemo creates a fully-shaped demo tenancy: landlord Rajesh and tenant
// Arun, a property, an active tenancy, a agreed agreement and a confirmed
// move-in inspection. It is idempotent: existing demo emails are left alone.
func SeedDemo(ctx context.Context, db *gorm.DB) error {
	passwordHash, err := auth.HashPassword(DemoPassword)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	var count int64
	if err := db.Model(&users.User{}).Where("email = ?", DemoLandlordEmail).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	now := time.Now().UTC()
	landlord := users.User{
		ID:           demoID("landlord"),
		Name:         DemoLandlordName,
		Email:        DemoLandlordEmail,
		PasswordHash: passwordHash,
		Role:         users.RoleLandlord,
		Status:       users.StatusActive,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	tenant := users.User{
		ID:           demoID("tenant"),
		Name:         DemoTenantName,
		Email:        DemoTenantEmail,
		PasswordHash: passwordHash,
		Role:         users.RoleTenant,
		Status:       users.StatusActive,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := db.Create(&landlord).Error; err != nil {
		return err
	}
	if err := db.Create(&tenant).Error; err != nil {
		return err
	}

	// Assign plans: Rajesh on Landlord, Arun on the free tier.
	billingSvc := billing.NewService(billing.NewRepository(db))
	if _, err := billingSvc.ChangeSubscription(ctx, landlord.ID, billing.PlanLandlord); err != nil {
		return err
	}
	if _, err := billingSvc.ChangeSubscription(ctx, tenant.ID, billing.PlanFREE); err != nil {
		return err
	}

	// Property.
	semifurnished := properties.SemiFurnished
	prop := properties.Property{
		ID:               demoID("property"),
		LandlordID:       landlord.ID,
		PropertyName:     "Lakeview Apartment, 2BHK",
		PropertyType:     properties.TypeApartment,
		AddressLine1:     strPtr("Building 42, 100 Feet Road"),
		Locality:         strPtr("Koramangala 5th Block"),
		City:             strPtr("Bengaluru"),
		State:            strPtr("Karnataka"),
		PostalCode:       strPtr("560095"),
		Bedrooms:         intPtr(2),
		Bathrooms:        intPtr(2),
		FurnishingStatus: &semifurnished,
		Description:      strPtr("Semi-furnished 2 BHK with a balcony; gated community."),
		Status:           properties.StatusActive,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if err := db.Create(&prop).Error; err != nil {
		return err
	}

	// Tenancy (ACTIVE).
	start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(1, 0, 0).AddDate(0, 0, -1)
	dueDay := 5
	tenancy := tenancies.Tenancy{
		ID:                   demoID("tenancy"),
		PropertyID:           prop.ID,
		LandlordID:           landlord.ID,
		TenantID:             &tenant.ID,
		AcceptedAt:           &start,
		StartDate:            &start,
		EndDate:              &end,
		MonthlyRentMinor:     3000000,
		SecurityDepositMinor: 10000000,
		Currency:             "INR",
		NoticePeriodDays:     30,
		RentDueDay:           &dueDay,
		Status:               tenancies.StatusActive,
		CreatedAt:            now,
		UpdatedAt:            now,
	}
	if err := db.Create(&tenancy).Error; err != nil {
		return err
	}

	// Agreement version 1, fully confirmed.
	terms := agreements.Terms{
		NoticePeriodDays:     30,
		MonthlyRentMinor:     3000000,
		SecurityDepositMinor: 10000000,
		Currency:             "INR",
		MonthlyPaymentDay:    5,
		LateFeeMinor:         2500,
		UtilityInclusions:    []string{"Water", "Society maintenance"},
		Clauses:              []string{"No subletting without written consent", "Minor wear and tear exempted"},
	}
	termsJSON, err := json.Marshal(terms)
	if err != nil {
		return err
	}
	agreement := agreements.RentalAgreementVersion{
		ID:                  demoID("agreement"),
		TenancyID:           tenancy.ID,
		VersionNumber:       1,
		TermsJSON:           datatypes.JSON(termsJSON),
		CreatedBy:           landlord.ID,
		LandlordConfirmedAt: &now,
		TenantConfirmedAt:   &now,
		CreatedAt:           now,
	}
	if err := db.Create(&agreement).Error; err != nil {
		return err
	}

	// Confirmed move-in inspection with rooms and items.
	insp := inspections.Inspection{
		ID:          demoID("inspection-movein"),
		TenancyID:   tenancy.ID,
		Kind:        inspections.KindMoveIn,
		Status:      inspections.StatusConfirmed,
		ConductedAt: &start,
		ConductedBy: &landlord.ID,
		Notes:       strPtr("Move-in inspection, jointly reviewed with the tenant."),
		CreatedBy:   landlord.ID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := db.Create(&insp).Error; err != nil {
		return err
	}
	if err := db.Create(&inspections.Confirmation{
		ID:           demoID("insp-confirm-landlord"),
		InspectionID: insp.ID,
		UserID:       landlord.ID,
		ConfirmedAt:  now,
	}).Error; err != nil {
		return err
	}
	if err := db.Create(&inspections.Confirmation{
		ID:           demoID("insp-confirm-tenant"),
		InspectionID: insp.ID,
		UserID:       tenant.ID,
		ConfirmedAt:  now,
	}).Error; err != nil {
		return err
	}

	rooms := []struct {
		id    string
		name  string
		items []struct {
			id, name, condition string
			notes               string
		}
	}{
		{"room-living", "Living Room", []struct{ id, name, condition, notes string }{
			{"item-sofa", "Sofa", inspections.ConditionGood, ""},
			{"item-tv", "TV Unit", inspections.ConditionExcellent, ""},
			{"item-lamp", "Floor Lamp", inspections.ConditionGood, ""},
		}},
		{"room-kitchen", "Kitchen", []struct{ id, name, condition, notes string }{
			{"item-fridge", "Refrigerator", inspections.ConditionGood, "Chiller set to 3"},
			{"item-stove", "Gas Stove", inspections.ConditionFair, ""},
		}},
	}
	for i, room := range rooms {
		r := inspections.Room{
			ID:           demoID(room.id),
			InspectionID: insp.ID,
			Name:         room.name,
			SortOrder:    i + 1,
			CreatedAt:    now,
		}
		if err := db.Create(&r).Error; err != nil {
			return err
		}
		for _, it := range room.items {
			item := inspections.Item{
				ID:        demoID(it.id),
				RoomID:    r.ID,
				Name:      it.name,
				Condition: &it.condition,
				Notes:     optStr(it.notes),
				CreatedAt: now,
				UpdatedAt: now,
			}
			if err := db.Create(&item).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func strPtr(s string) *string { return &s }
func intPtr(i int) *int       { return &i }

func optStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
