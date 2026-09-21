package tests

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"rental-settlement/backend/internal/server"
)

func TestSettlementFullFlow(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	landlordAccess, tenantAccess, tenancyID := setupParties(t, app)
	acceptTenancy(t, app, tenancyID, tenantAccess)
	moveOutTenancy(t, app, landlordAccess, tenantAccess, tenancyID)

	// While occupied, the property is not on the tenant marketplace.
	resp := Perform(app, http.MethodGet, "/api/v1/properties", "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var owner struct {
		Data []struct {
			ID     string `json:"id"`
			Listed bool   `json:"listed"`
		}
	}
	require.NoError(t, decode(resp, &owner))
	require.NotEmpty(t, owner.Data)
	propertyID := owner.Data[0].ID
	require.False(t, owner.Data[0].Listed, "property must be unlisted while a tenancy is active")
	resp = Perform(app, http.MethodGet, "/api/v1/properties/listed", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	require.NotContains(t, string(resp.Body.Bytes()), propertyID, "occupied property must not appear in the marketplace")

	// Landlord raises a deduction and tenant agrees to a reduced part
	// through negotiation, reaching an AGREED claim.
	resp = Perform(app, http.MethodPost, "/api/v1/deductions/tenancy/"+tenancyID, `{"category":"PROPERTY_DAMAGE","title":"Damaged wardrobe","claimed_amount_minor":500000,"currency":"INR"}`, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var claim struct {
		Data struct{ ID string }
	}
	require.NoError(t, decode(resp, &claim))

	resp = Perform(app, http.MethodPost, "/api/v1/deductions/"+claim.Data.ID+"/dispute", `{"reason":"Fair wear and tear"}`, tenantAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var dispute struct {
		Data struct{ ID string }
	}
	require.NoError(t, decode(resp, &dispute))

	resp = Perform(app, http.MethodPost, "/api/v1/disputes/"+dispute.Data.ID+"/counter-offer", `{"new_amount_minor":50000,"reason":"Settle"}`, landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	resp = Perform(app, http.MethodPost, "/api/v1/disputes/"+dispute.Data.ID+"/accept", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	// Landlord generates the settlement.
	resp = Perform(app, http.MethodPost, "/api/v1/settlements/tenancy/"+tenancyID, `{"recorded_deposit_minor":10000000,"currency":"INR"}`, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var set struct {
		Data struct {
			Status               string `json:"status"`
			RecordedDepositMinor int64  `json:"recorded_deposit_minor"`
			TotalDeductionMinor  int64  `json:"total_deduction_minor"`
			RemainingAmountMinor int64  `json:"remaining_amount_minor"`
			Items                []struct {
				Title    string `json:"title"`
				Amount   int64  `json:"amount_minor"`
				Category string `json:"category"`
			} `json:"items"`
		}
	}
	require.NoError(t, decode(resp, &set))
	require.Equal(t, "DRAFT", set.Data.Status)
	require.Equal(t, int64(10000000), set.Data.RecordedDepositMinor)
	require.Equal(t, int64(50000), set.Data.TotalDeductionMinor)
	require.Equal(t, int64(9950000), set.Data.RemainingAmountMinor)
	require.Equal(t, 1, len(set.Data.Items))
	require.Equal(t, "Damaged wardrobe", set.Data.Items[0].Title)

	// Tenant confirms.
	resp = Perform(app, http.MethodPost, "/api/v1/settlements/tenancy/"+tenancyID+"/confirm", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	// Both confirmed: settlement CONFIRMED and tenancy SETTLED.
	resp = Perform(app, http.MethodGet, "/api/v1/settlements/tenancy/"+tenancyID, "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var final struct {
		Data struct {
			Status      string `json:"status"`
			ConfirmedAt string `json:"confirmed_at"`
		}
	}
	require.NoError(t, decode(resp, &final))
	require.Equal(t, "CONFIRMED", final.Data.Status)
	require.NotEmpty(t, final.Data.ConfirmedAt)

	resp = Perform(app, http.MethodGet, "/api/v1/tenancies/"+tenancyID, "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var ten struct {
		Data struct {
			Status string `json:"status"`
		}
	}
	require.NoError(t, decode(resp, &ten))
	require.Equal(t, "SETTLED", ten.Data.Status)

	// The settled property goes back on the marketplace.
	resp = Perform(app, http.MethodGet, "/api/v1/properties", "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	require.NoError(t, decode(resp, &owner))
	require.True(t, owner.Data[0].Listed, "property must be re-listed after the tenancy is settled")
	resp = Perform(app, http.MethodGet, "/api/v1/properties/listed", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	require.Contains(t, string(resp.Body.Bytes()), propertyID, "settled property must reappear in the marketplace")

	// Active tenancy usage released.
	resp = Perform(app, http.MethodGet, "/api/v1/billing/usage", "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var usage struct {
		Data struct {
			ActiveTenancyCount int64 `json:"active_tenancy_count"`
		}
	}
	require.NoError(t, decode(resp, &usage))
	require.Equal(t, int64(0), usage.Data.ActiveTenancyCount)
}

func TestSettlementRegenerate(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	landlordAccess, tenantAccess, tenancyID := setupParties(t, app)
	acceptTenancy(t, app, tenancyID, tenantAccess)
	moveOutTenancy(t, app, landlordAccess, tenantAccess, tenancyID)

	// First agreed deduction.
	createAgreedClaim(t, app, landlordAccess, tenantAccess, tenancyID, "Damaged wardrobe", 500000)

	resp := Perform(app, http.MethodPost, "/api/v1/settlements/tenancy/"+tenancyID, `{"recorded_deposit_minor":10000000,"currency":"INR"}`, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var set struct {
		Data struct {
			VersionNumber       int    `json:"version_number"`
			Status              string `json:"status"`
			TotalDeductionMinor int64  `json:"total_deduction_minor"`
			Items               []struct {
				Title string `json:"title"`
			} `json:"items"`
			TenantConfirmedAt *string `json:"tenant_confirmed_at"`
		}
	}
	require.NoError(t, decode(resp, &set))
	require.Equal(t, 1, set.Data.VersionNumber)
	require.Equal(t, int64(500000), set.Data.TotalDeductionMinor)
	require.Equal(t, 1, len(set.Data.Items))

	// Additional change: a second deduction arrives and is agreed.
	createAgreedClaim(t, app, landlordAccess, tenantAccess, tenancyID, "Broken window", 200000)

	// Landlord regenerates to pick up the change.
	resp = Perform(app, http.MethodPost, "/api/v1/settlements/tenancy/"+tenancyID+"/regenerate", `{"recorded_deposit_minor":10000000,"currency":"INR"}`, landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	require.NoError(t, decode(resp, &set))
	require.Equal(t, 2, set.Data.VersionNumber)
	require.Equal(t, "DRAFT", set.Data.Status)
	require.Equal(t, int64(700000), set.Data.TotalDeductionMinor)
	require.Equal(t, 2, len(set.Data.Items))
	require.Nil(t, set.Data.TenantConfirmedAt, "confirmations must reset on regeneration")

	// A tenant cannot regenerate.
	resp = Perform(app, http.MethodPost, "/api/v1/settlements/tenancy/"+tenancyID+"/regenerate", `{}`, tenantAccess)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))

	// A settlement that does not exist cannot be regenerated.
	otherLandlord, otherTenant, otherTenancy := setupTenancyForLandlord(t, app)
	acceptTenancy(t, app, otherTenancy, otherTenant)
	moveOutTenancy(t, app, otherLandlord, otherTenant, otherTenancy)
	resp = Perform(app, http.MethodPost, "/api/v1/settlements/tenancy/"+otherTenancy+"/regenerate", `{}`, otherLandlord)
	require.Equal(t, http.StatusNotFound, resp.Code, readBody(resp))

	// After the tenant confirms the regenerated version, the settlement is
	// closed and regeneration is refused.
	resp = Perform(app, http.MethodPost, "/api/v1/settlements/tenancy/"+tenancyID+"/confirm", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	resp = Perform(app, http.MethodPost, "/api/v1/settlements/tenancy/"+tenancyID+"/regenerate", `{}`, landlordAccess)
	require.Equal(t, http.StatusBadRequest, resp.Code, readBody(resp))
}

func setupTenancyForLandlord(t *testing.T, app *server.App) (landlordAccess, tenantAccess, tenancyID string) {
	t.Helper()
	lName, lEmail := landlordUser()
	landlordAccess, _, _ = RegisterAndLogin(t, app, lName, lEmail, "password123", "LANDLORD")
	tName, tEmail := tenantUser()
	tenantAccess, _, _ = RegisterAndLogin(t, app, tName, tEmail, "password123", "TENANT")
	propertyID := createPropertyForLandlord(t, app, landlordAccess)
	return landlordAccess, tenantAccess, inviteTenant(t, app, landlordAccess, tEmail, propertyID)
}

func createAgreedClaim(t *testing.T, app *server.App, landlordAccess, tenantAccess, tenancyID, title string, amount int64) string {
	t.Helper()
	body := `{"category":"PROPERTY_DAMAGE","title":"` + title + `","claimed_amount_minor":` + fmt.Sprintf("%d", amount) + `,"currency":"INR"}`
	resp := Perform(app, http.MethodPost, "/api/v1/deductions/tenancy/"+tenancyID, body, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var claim struct {
		Data struct{ ID string }
	}
	require.NoError(t, decode(resp, &claim))
	resp = Perform(app, http.MethodPost, "/api/v1/deductions/"+claim.Data.ID+"/accept", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	return claim.Data.ID
}
