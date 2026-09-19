package tests

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"rental-settlement/backend/internal/server"
)

func createPropertyForLandlord(t *testing.T, app *server.App, access string) string {
	t.Helper()
	resp := Perform(app, http.MethodPost, "/api/v1/properties", `{"property_name":"Test Flat","property_type":"APARTMENT"}`, access)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var out struct {
		Data struct {
			ID string `json:"id"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &out))
	require.NotEmpty(t, out.Data.ID)
	return out.Data.ID
}

func inviteTenant(t *testing.T, app *server.App, landlordAccess, email string, propertyID string) string {
	t.Helper()
	invite := fmt.Sprintf(`{"property_id":%q,"invited_email":%q,"monthly_rent_minor":3000000,"security_deposit_minor":0,"currency":"INR","rent_due_day":5}`, propertyID, email)
	resp := Perform(app, http.MethodPost, "/api/v1/tenancies", invite, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var created struct {
		Data struct {
			ID  string `json:"id"`
			Ten string `json:"invited_email"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &created))
	require.NotEmpty(t, created.Data.ID)
	return created.Data.ID
}

// fetchTenancy returns (id, invite_token) for the first tenancy in the DB.
func fetchTenancy(t *testing.T, db *gorm.DB) (string, string) {
	t.Helper()
	var id, token string
	require.NoError(t, db.Raw(`SELECT id::text, invite_token FROM tenancies ORDER BY created_at LIMIT 1`).Row().Scan(&id, &token))
	return id, token
}

func TestTenancyLifecycle(t *testing.T) {
	app, db, cleanup := NewTestApp(t)
	defer cleanup()

	lName, lEmail := landlordUser()
	landlordAccess, _, _ := RegisterAndLogin(t, app, lName, lEmail, "password123", "LANDLORD")
	tName, tEmail := tenantUser()
	tenantAccess, _, _ := RegisterAndLogin(t, app, tName, tEmail, "password123", "TENANT")

	propertyID := createPropertyForLandlord(t, app, landlordAccess)

	// Landlord invites a tenant.
	tenancyID := inviteTenant(t, app, landlordAccess, tEmail, propertyID)
	_, token := fetchTenancy(t, db)
	require.NotEmpty(t, token)

	// Unauthorized user cannot see the tenancy.
	resp := Perform(app, http.MethodGet, "/api/v1/tenancies/"+tenancyID, "", tenantAccess)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))

	// Tenant cannot use their own invite token on a different tenancy id.
	resp = Perform(app, http.MethodPost, "/api/v1/tenancies/00000000-0000-0000-0000-000000000000/accept", fmt.Sprintf(`{"invite_token":%q}`, token), tenantAccess)
	require.Equal(t, http.StatusNotFound, resp.Code, readBody(resp))

	// A different tenant's email cannot accept the invite.
	otherAccess, _, _ := RegisterAndLogin(t, app, "Other Tenant", uniqueEmail("other"), "password123", "TENANT")
	resp = Perform(app, http.MethodPost, "/api/v1/tenancies/"+tenancyID+"/accept", fmt.Sprintf(`{"invite_token":%q}`, token), otherAccess)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))

	// Invited tenant accepts and the tenancy becomes ACTIVE.
	resp = Perform(app, http.MethodPost, "/api/v1/tenancies/"+tenancyID+"/accept", fmt.Sprintf(`{"invite_token":%q}`, token), tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	// Invite token must not work any more (already used).
	resp = Perform(app, http.MethodPost, "/api/v1/tenancies/"+tenancyID+"/accept", fmt.Sprintf(`{"invite_token":%q}`, token), tenantAccess)
	require.Equal(t, http.StatusNotFound, resp.Code, readBody(resp))

	// Both parties can now read the tenancy.
	resp = Perform(app, http.MethodGet, "/api/v1/tenancies/"+tenancyID, "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	resp = Perform(app, http.MethodGet, "/api/v1/tenancies/"+tenancyID, "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	// Active tenancy count usage becomes 1.
	resp = Perform(app, http.MethodGet, "/api/v1/billing/usage", "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var usage struct {
		Data struct {
			ActiveTenancyCount int64 `json:"active_tenancy_count"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &usage))
	require.Equal(t, int64(1), usage.Data.ActiveTenancyCount)
}

func TestTenancyLimitAndTransitions(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	lName, lEmail := landlordUser()
	landlordAccess, _, _ := RegisterAndLogin(t, app, lName, lEmail, "password123", "LANDLORD")
	tName, tEmail := tenantUser()
	tenantAccess, _, _ := RegisterAndLogin(t, app, tName, tEmail, "password123", "TENANT")

	propertyID := createPropertyForLandlord(t, app, landlordAccess)
	tenancyID := inviteTenant(t, app, landlordAccess, tEmail, propertyID)

	// FREE plan allows 1 active tenancy: a second invite must fail.
	resp := Perform(app, http.MethodPost, "/api/v1/tenancies", fmt.Sprintf(`{"property_id":%q,"invited_email":%q,"monthly_rent_minor":100,"currency":"INR"}`, propertyID, uniqueEmail("second")), landlordAccess)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))
	var errResp struct {
		Error struct {
			Code string `json:"code"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &errResp))
	require.Equal(t, "PLAN_LIMIT_REACHED", errResp.Error.Code)

	// Tenant cannot cancel; landlord can.
	resp = Perform(app, http.MethodPost, "/api/v1/tenancies/"+tenancyID+"/status", `{"status":"CANCELLED"}`, tenantAccess)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))

	resp = Perform(app, http.MethodPost, "/api/v1/tenancies/"+tenancyID+"/status", `{"status":"CANCELLED"}`, landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	// After cancellation the limit slot is free again.
	resp = Perform(app, http.MethodPost, "/api/v1/tenancies", fmt.Sprintf(`{"property_id":%q,"invited_email":%q,"monthly_rent_minor":100,"currency":"INR"}`, propertyID, uniqueEmail("second")), landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
}
