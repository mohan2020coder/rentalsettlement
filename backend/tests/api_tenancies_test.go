package tests

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

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

// inviteTenant creates an in-app tenancy invitation for a registered tenant.
func inviteTenant(t *testing.T, app *server.App, landlordAccess, email string, propertyID string) string {
	t.Helper()
	invite := fmt.Sprintf(`{"property_id":%q,"invited_email":%q,"monthly_rent_minor":3000000,"security_deposit_minor":0,"currency":"INR","rent_due_day":5}`, propertyID, email)
	resp := Perform(app, http.MethodPost, "/api/v1/tenancies", invite, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var created struct {
		Data struct {
			ID string `json:"id"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &created))
	require.NotEmpty(t, created.Data.ID)
	return created.Data.ID
}

func TestTenancyLifecycle(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	lName, lEmail := landlordUser()
	landlordAccess, _, _ := RegisterAndLogin(t, app, lName, lEmail, "password123", "LANDLORD")
	tName, tEmail := tenantUser()
	tenantAccess, _, _ := RegisterAndLogin(t, app, tName, tEmail, "password123", "TENANT")

	propertyID := createPropertyForLandlord(t, app, landlordAccess)

	// Landlord invites a registered tenant; the invitation is managed in-app.
	tenancyID := inviteTenant(t, app, landlordAccess, tEmail, propertyID)

	// A user who is not a party cannot see the tenancy.
	otherAccess, _, _ := RegisterAndLogin(t, app, "Other Tenant", uniqueEmail("other"), "password123", "TENANT")
	resp := Perform(app, http.MethodGet, "/api/v1/tenancies/"+tenancyID, "", otherAccess)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))

	// Accepting a non-existent tenancy fails.
	resp = Perform(app, http.MethodPost, "/api/v1/tenancies/00000000-0000-0000-0000-000000000000/accept", `{}`, tenantAccess)
	require.Equal(t, http.StatusNotFound, resp.Code, readBody(resp))

	// A different tenant cannot accept the invitation.
	resp = Perform(app, http.MethodPost, "/api/v1/tenancies/"+tenancyID+"/accept", `{}`, otherAccess)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))

	// The invited tenant accepts and the tenancy becomes ACTIVE.
	resp = Perform(app, http.MethodPost, "/api/v1/tenancies/"+tenancyID+"/accept", `{}`, tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	// An already-accepted tenancy cannot be accepted again.
	resp = Perform(app, http.MethodPost, "/api/v1/tenancies/"+tenancyID+"/accept", `{}`, tenantAccess)
	require.Equal(t, http.StatusBadRequest, resp.Code, readBody(resp))

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

func TestTenancyInvitesOnlyRegisteredTenants(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	lName, lEmail := landlordUser()
	landlordAccess, _, _ := RegisterAndLogin(t, app, lName, lEmail, "password123", "LANDLORD")

	propertyID := createPropertyForLandlord(t, app, landlordAccess)

	// An email with no registered account cannot be invited.
	resp := Perform(app, http.MethodPost, "/api/v1/tenancies", fmt.Sprintf(`{"property_id":%q,"invited_email":%q,"monthly_rent_minor":100,"currency":"INR"}`, propertyID, uniqueEmail("ghost")), landlordAccess)
	require.Equal(t, http.StatusBadRequest, resp.Code, readBody(resp))
	require.Contains(t, readBody(resp), "INVITEE_NOT_FOUND")

	// A landlord account cannot be invited as a tenant.
	resp = Perform(app, http.MethodPost, "/api/v1/tenancies", fmt.Sprintf(`{"property_id":%q,"invited_email":%q,"monthly_rent_minor":100,"currency":"INR"}`, propertyID, lEmail), landlordAccess)
	require.Equal(t, http.StatusBadRequest, resp.Code, readBody(resp))
	require.Contains(t, readBody(resp), "INVITEE_NOT_FOUND")
}

func TestTenancyLimitAndTransitions(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	lName, lEmail := landlordUser()
	landlordAccess, _, _ := RegisterAndLogin(t, app, lName, lEmail, "password123", "LANDLORD")
	t1Name, t1Email := tenantUser()
	t1Access, _, _ := RegisterAndLogin(t, app, t1Name, t1Email, "password123", "TENANT")
	secondEmail := uniqueEmail("second")
	t2Access, _, _ := RegisterAndLogin(t, app, "Second Tenant", secondEmail, "password123", "TENANT")

	propertyID := createPropertyForLandlord(t, app, landlordAccess)
	firstID := inviteTenant(t, app, landlordAccess, t1Email, propertyID)

	// FREE plan allows 1 active tenancy: a second invite fails while one
	// occupies the slot.
	resp := Perform(app, http.MethodPost, "/api/v1/tenancies", fmt.Sprintf(`{"property_id":%q,"invited_email":%q,"monthly_rent_minor":100,"currency":"INR"}`, propertyID, secondEmail), landlordAccess)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))
	var errResp struct {
		Error struct {
			Code string `json:"code"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &errResp))
	require.Equal(t, "PLAN_LIMIT_REACHED", errResp.Error.Code)

	// The tenant may decline an invitation.
	resp = Perform(app, http.MethodPost, "/api/v1/tenancies/"+firstID+"/status", `{"status":"CANCELLED"}`, t1Access)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	// Slot is free again; inviting a different registered tenant works.
	secondID := inviteTenant(t, app, landlordAccess, secondEmail, propertyID)

	// Once ACTIVE, the tenant cannot cancel; the landlord can.
	resp = Perform(app, http.MethodPost, "/api/v1/tenancies/"+secondID+"/accept", `{}`, t2Access)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	resp = Perform(app, http.MethodPost, "/api/v1/tenancies/"+secondID+"/status", `{"status":"CANCELLED"}`, t2Access)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))
	resp = Perform(app, http.MethodPost, "/api/v1/tenancies/"+secondID+"/status", `{"status":"CANCELLED"}`, landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
}
