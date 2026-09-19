package tests

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUsersMe(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	access, _, userID := RegisterAndLogin(t, app, "Rajesh Kumar", uniqueEmail("profile"), "password123", "LANDLORD")

	// Profile fetch requires auth.
	resp := Perform(app, http.MethodGet, "/api/v1/users/me", "", "")
	require.Equal(t, http.StatusUnauthorized, resp.Code, readBody(resp))

	resp = Perform(app, http.MethodGet, "/api/v1/users/me", "", access)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var me struct {
		Data struct {
			ID    string `json:"id"`
			Email string `json:"email"`
			Role  string `json:"role"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &me))
	require.Equal(t, userID.String(), me.Data.ID)
	require.Equal(t, "LANDLORD", me.Data.Role)

	// Profile update.
	resp = Perform(app, http.MethodPatch, "/api/v1/users/me", `{"name":"Rajesh K Updated"}`, access)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var updated struct {
		Data struct {
			Name string `json:"name"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &updated))
	require.Equal(t, "Rajesh K Updated", updated.Data.Name)

	// Role cannot be changed by the user.
	resp = Perform(app, http.MethodPatch, "/api/v1/users/me", `{"role":"TENANT"}`, access)
	require.Equal(t, http.StatusBadRequest, resp.Code, readBody(resp))
}
