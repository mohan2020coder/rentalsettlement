package tests

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAuditTrailEndpoints(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	_, tenantAccess, tenancyID := setupParties(t, app)
	acceptTenancy(t, app, tenancyID, tenantAccess)

	// Landlord creates a property-level record early by updating status flow:
	// a move-out notification wraps several audit entries on the tenancy.
	resp := Perform(app, http.MethodPost, "/api/v1/inspections/tenancy/"+tenancyID+"/move-out", `{"notes":"Test"}`, tenantAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))

	// Tenant can read the tenancy audit log.
	resp = Perform(app, http.MethodGet, "/api/v1/audit/tenancy/"+tenancyID, "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var log1 struct {
		Data []struct {
			Action string `json:"action"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &log1))
	require.NotEmpty(t, log1.Data)

	// Tenant is a party so GET /audit/me works for their own entries.
	resp = Perform(app, http.MethodGet, "/api/v1/audit/me", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var me struct {
		Data []json.RawMessage
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &me))
	require.NotEmpty(t, me.Data)

	// A stranger is forbidden from reading the tenancy audit trail.
	stranger, _, _ := RegisterAndLogin(t, app, "Stranger", uniqueEmail("stranger"), "password123", "TENANT")
	resp = Perform(app, http.MethodGet, "/api/v1/audit/tenancy/"+tenancyID, "", stranger)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))
}

func TestNotificationsEndpoints(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	_, tenantAccess, tenancyID := setupParties(t, app)
	acceptTenancy(t, app, tenancyID, tenantAccess)

	// Invitation created a notification for the tenant.
	resp := Perform(app, http.MethodGet, "/api/v1/notifications", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var list struct {
		Data []struct {
			ID     string `json:"id"`
			Type   string `json:"type"`
			IsRead bool   `json:"is_read"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &list))
	require.NotEmpty(t, list.Data)

	resp = Perform(app, http.MethodGet, "/api/v1/notifications/unread-count", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var count struct {
		Data struct {
			UnreadCount int64 `json:"unread_count"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &count))
	require.Greater(t, count.Data.UnreadCount, int64(0))

	firstID := list.Data[0].ID
	resp = Perform(app, http.MethodPost, "/api/v1/notifications/"+firstID+"/read", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	resp = Perform(app, http.MethodPost, "/api/v1/notifications/read-all", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	resp = Perform(app, http.MethodGet, "/api/v1/notifications/unread-count", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &count))
	require.Equal(t, int64(0), count.Data.UnreadCount)
}

func TestEvidencePdfDownload(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	landlordAccess, tenantAccess, tenancyID := setupParties(t, app)
	acceptTenancy(t, app, tenancyID, tenantAccess)
	moveOutTenancy(t, app, landlordAccess, tenantAccess, tenancyID)

	// Add some records so the dossier is non-trivial.
	resp := Perform(app, http.MethodPost, "/api/v1/deductions/tenancy/"+tenancyID, `{"category":"PROPERTY_DAMAGE","title":"Cracked tile","claimed_amount_minor":25000,"currency":"INR"}`, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var claim struct {
		Data struct{ ID string }
	}
	require.NoError(t, decode(resp, &claim))

	// Both parties can download the PDF.
	for _, who := range []string{landlordAccess, tenantAccess} {
		resp = Perform(app, http.MethodGet, "/api/v1/evidence/tenancy/"+tenancyID+"/download", "", who)
		require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
		require.Greater(t, len(resp.Body.Bytes()), 500)
		require.Contains(t, resp.Header().Get("Content-Type"), "application/pdf")
	}

	// A stranger cannot.
	stranger, _, _ := RegisterAndLogin(t, app, "Evil", uniqueEmail("evil"), "password123", "TENANT")
	resp = Perform(app, http.MethodGet, "/api/v1/evidence/tenancy/"+tenancyID+"/download", "", stranger)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))
}
