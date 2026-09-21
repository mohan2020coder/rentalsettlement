package tests

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"rental-settlement/backend/internal/server"
)

// setupParties returns an ACTIVE tenancy id with a LANDLORD and TENANT user.
func setupParties(t *testing.T, app *server.App) (landlordAccess, tenantAccess, tenancyIDKey string) {
	t.Helper()
	lName, lEmail := landlordUser()
	landlordAccess, _, _ = RegisterAndLogin(t, app, lName, lEmail, "password123", "LANDLORD")
	tName, tEmail := tenantUser()
	tenantAccess, _, _ = RegisterAndLogin(t, app, tName, tEmail, "password123", "TENANT")

	propertyID := createPropertyForLandlord(t, app, landlordAccess)
	tenancyIDKey = inviteTenant(t, app, landlordAccess, tEmail, propertyID)
	return
}

func acceptTenancy(t *testing.T, app *server.App, tenancyID, tenantAccess string) {
	t.Helper()
	resp := Perform(app, http.MethodPost, "/api/v1/tenancies/"+tenancyID+"/accept", `{}`, tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
}

func TestAgreementLifecycle(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	landlordAccess, tenantAccess, tenancyID := setupParties(t, app)
	acceptTenancy(t, app, tenancyID, tenantAccess)

	// Landlord creates version 1.
	termsBody := `{
		"notice_period_days": 30,
		"monthly_rent_minor": 3000000,
		"security_deposit_minor": 10000000,
		"currency": "INR",
		"monthly_payment_day": 5,
		"utilities_inclusions":["Water"],
		"clauses":["Maintenance responsibility"]
	}`
	resp := Perform(app, http.MethodPost, "/api/v1/agreements/tenancy/"+tenancyID+"/versions", termsBody, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var created struct {
		Data struct {
			ID            string `json:"id"`
			VersionNumber int    `json:"version_number"`
			Terms         map[string]any
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &created))
	require.Equal(t, 1, created.Data.VersionNumber)
	require.Equal(t, float64(3000000), created.Data.Terms["monthly_rent_minor"])

	// Tenant sees it as current.
	resp = Perform(app, http.MethodGet, "/api/v1/agreements/tenancy/"+tenancyID+"/current", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	// Tenant approves.
	resp = Perform(app, http.MethodPost, "/api/v1/agreements/tenancy/"+tenancyID+"/versions/1/approve", `{}`, tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var afterTenant struct {
		Data struct {
			TenantConfirmedAt string `json:"tenant_confirmed_at"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &afterTenant))
	require.NotEmpty(t, afterTenant.Data.TenantConfirmedAt)

	// Landlord must not be able to double-confirm.
	resp = Perform(app, http.MethodPost, "/api/v1/agreements/tenancy/"+tenancyID+"/versions/1/approve", `{}`, landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var both struct {
		Data struct {
			FullyConfirmed bool   `json:"fully_confirmed"`
			LandlordConf   string `json:"landlord_confirmed_at"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &both))
	require.Equal(t, true, both.Data.FullyConfirmed)

	// Landlord drafts version 2 (revision).
	resp = Perform(app, http.MethodPost, "/api/v1/agreements/tenancy/"+tenancyID+"/versions", termsBody, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var v2 struct {
		Data struct {
			VersionNumber int `json:"version_number"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &v2))
	require.Equal(t, 2, v2.Data.VersionNumber)
}
