package tests

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMaintenanceFlow(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	landlordAccess, tenantAccess, tenancyID := setupParties(t, app)
	acceptTenancy(t, app, tenancyID, tenantAccess)

	// Tenant reports an issue.
	resp := Perform(app, http.MethodPost, "/api/v1/maintenance/tenancy/"+tenancyID, `{"title":"Leaking tap","description":"Dripping since yesterday","category":"PLUMBING","priority":"HIGH"}`, tenantAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var created struct {
		Data struct {
			ID       string `json:"id"`
			Status   string `json:"status"`
			Category string `json:"category"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &created))
	requestID := created.Data.ID
	require.Equal(t, "OPEN", created.Data.Status)
	require.Equal(t, "PLUMBING", created.Data.Category)

	// Landlord acknowledges.
	resp = Perform(app, http.MethodPost, "/api/v1/maintenance/"+requestID+"/status", `{"status":"ACKNOWLEDGED","comment":"Will look into it"}`, landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	// Tenant cannot resolve (landlord-only action).
	resp = Perform(app, http.MethodPost, "/api/v1/maintenance/"+requestID+"/status", `{"status":"RESOLVED"}`, tenantAccess)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))

	// Landlord resolves it.
	resp = Perform(app, http.MethodPost, "/api/v1/maintenance/"+requestID+"/status", `{"status":"RESOLVED"}`, landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var resolved struct {
		Data struct {
			Status     string `json:"status"`
			ResolvedAt string `json:"resolved_at"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &resolved))
	require.Equal(t, "RESOLVED", resolved.Data.Status)
	require.NotEmpty(t, resolved.Data.ResolvedAt)

	// Comments can be added by both and listed.
	resp = Perform(app, http.MethodPost, "/api/v1/maintenance/"+requestID+"/comments", `{"body":"Fixed, please verify"}`, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	resp = Perform(app, http.MethodGet, "/api/v1/maintenance/"+requestID+"/comments", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var comments struct {
		Data []struct {
			Body string `json:"body"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &comments))
	require.Equal(t, 1, len(comments.Data))
	require.Equal(t, "Fixed, please verify", comments.Data[0].Body)

	// Out-of-tenancy user cannot fetch the request.
	resp = Perform(app, http.MethodGet, "/api/v1/maintenance/"+requestID, "", func() string {
		access, _, _ := RegisterAndLogin(t, app, "Outsider", uniqueEmail("outsider"), "password123", "TENANT")
		return access
	}())
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))

	// Media attachment records storage usage.
	resp = Perform(app, http.MethodPost, "/api/v1/maintenance/"+requestID+"/media", `{"file_path":"media/2026/09/abc.jpg","mime_type":"image/jpeg","file_size":204800,"sha256_hash":"abc123"}`, tenantAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))

	resp = Perform(app, http.MethodGet, "/api/v1/billing/usage", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var usage struct {
		Data struct {
			StorageBytes int64 `json:"storage_bytes"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &usage))
	require.Equal(t, int64(204800), usage.Data.StorageBytes)

	_ = fmt.Sprintf
}
