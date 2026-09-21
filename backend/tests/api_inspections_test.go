package tests

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestInspectionLifecycle(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	landlordAccess, tenantAccess, tenancyID := setupParties(t, app)
	acceptTenancy(t, app, tenancyID, tenantAccess)

	// Landlord creates a move-in inspection from the template.
	resp := Perform(app, http.MethodPost, "/api/v1/inspections/tenancy/"+tenancyID+"/move-in", `{"notes":"Initial state"}`, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var created struct {
		Data struct {
			ID      string `json:"id"`
			Kind    string `json:"kind"`
			Status  string `json:"status"`
			Tenancy string `json:"tenancy_id"`
			Rooms   []struct {
				ID    string `json:"id"`
				Name  string `json:"name"`
				Items []struct {
					ID string `json:"id"`
				} `json:"items"`
			} `json:"rooms"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &created))
	inspectionID := created.Data.ID
	require.Equal(t, "MOVE_IN", created.Data.Kind)
	require.Equal(t, "DRAFT", created.Data.Status)
	require.NotEmpty(t, created.Data.Rooms)
	require.NotEmpty(t, created.Data.Rooms[0].Items)
	roomID := created.Data.Rooms[0].ID
	itemID := created.Data.Rooms[0].Items[0].ID

	// Tenant saves an item condition.
	resp = Perform(app, http.MethodPut, fmt.Sprintf("/api/v1/inspections/%s/rooms/%s/items/%s", inspectionID, roomID, itemID), `{"condition":"DAMAGED","notes":"Scratched"}`, tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var saved struct {
		Data struct {
			Condition string `json:"condition"`
			Notes     string `json:"notes"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &saved))
	require.Equal(t, "DAMAGED", saved.Data.Condition)

	// Invalid condition rejected.
	resp = Perform(app, http.MethodPut, fmt.Sprintf("/api/v1/inspections/%s/rooms/%s/items/%s", inspectionID, roomID, itemID), `{"condition":"BROKEN"}`, tenantAccess)
	require.Equal(t, http.StatusBadRequest, resp.Code, readBody(resp))

	// Non-party cannot read the inspection.
	resp = Perform(app, http.MethodGet, "/api/v1/inspections/"+inspectionID, "", func() string {
		access, _, _ := RegisterAndLogin(t, app, "Stranger", uniqueEmail("stranger"), "password123", "TENANT")
		return access
	}())
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))

	// Each party confirms; the second confirmation makes it CONFIRMED.
	resp = Perform(app, http.MethodPost, "/api/v1/inspections/"+inspectionID+"/confirm", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var confirmed struct {
		Data struct {
			Status      string   `json:"status"`
			ConfirmedBy []string `json:"confirmed_by"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &confirmed))
	require.Equal(t, "PENDING_CONFIRMATION", confirmed.Data.Status)

	resp = Perform(app, http.MethodPost, "/api/v1/inspections/"+inspectionID+"/confirm", "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var done struct {
		Data struct {
			Status string `json:"status"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &done))
	require.Equal(t, "CONFIRMED", done.Data.Status)

	// Items are frozen after confirmation.
	resp = Perform(app, http.MethodPut, fmt.Sprintf("/api/v1/inspections/%s/rooms/%s/items/%s", inspectionID, roomID, itemID), `{"condition":"GOOD"}`, tenantAccess)
	require.Equal(t, http.StatusBadRequest, resp.Code, readBody(resp))
}

func TestMoveOutInspectionFlow(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	landlordAccess, tenantAccess, tenancyID := setupParties(t, app)
	acceptTenancy(t, app, tenancyID, tenantAccess)

	// Move-in first.
	resp := Perform(app, http.MethodPost, "/api/v1/inspections/tenancy/"+tenancyID+"/move-in", `{}`, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var moveIn struct {
		Data struct {
			ID string `json:"id"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &moveIn))

	// Tenant gives notice via the move-out inspection.
	resp = Perform(app, http.MethodPost, "/api/v1/inspections/tenancy/"+tenancyID+"/move-out", `{"notes":"Vacating early"}`, tenantAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var moveOut struct {
		Data struct {
			ID    string `json:"id"`
			Kind  string `json:"kind"`
			Rooms []struct {
				Name  string        `json:"name"`
				Items []interface{} `json:"items"`
			} `json:"rooms"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &moveOut))
	require.Equal(t, "MOVE_OUT", moveOut.Data.Kind)
	hasDeparture := false
	for _, r := range moveOut.Data.Rooms {
		if r.Name == "Departure Checklist" {
			hasDeparture = true
		}
	}
	require.True(t, hasDeparture)

	// Tenancy advanced towards notice.
	resp = Perform(app, http.MethodGet, "/api/v1/tenancies/"+tenancyID, "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var ten struct {
		Data struct {
			Status string `json:"status"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &ten))
	require.Contains(t, []string{"NOTICE_GIVEN", "MOVE_OUT"}, ten.Data.Status)
}
