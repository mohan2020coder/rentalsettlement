package tests

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"rental-settlement/backend/seeds"
)

func TestSeedDemoData(t *testing.T) {
	app, db, cleanup := NewTestApp(t)
	defer cleanup()

	require.NoError(t, seeds.SeedDemo(context.Background(), db))

	// Second run is idempotent.
	require.NoError(t, seeds.SeedDemo(context.Background(), db))

	// Demo credentials log in through the real auth flow.
	resp := Perform(app, http.MethodPost, "/api/v1/auth/login",
		`{"email":"rajesh@example.in","password":"Demo@1234"}`, "")
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var login struct {
		Data struct {
			AccessToken string `json:"access_token"`
			User        struct {
				Role string `json:"role"`
			} `json:"user"`
		}
	}
	require.NoError(t, decode(resp, &login))
	require.Equal(t, "LANDLORD", login.Data.User.Role)
	token := login.Data.AccessToken

	// Rajesh sees his demo tenancy with tenant Arun.
	resp = Perform(app, http.MethodGet, "/api/v1/tenancies", "", token)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var list struct {
		Data []struct {
			Status      string `json:"status"`
			MonthlyRent int64  `json:"monthly_rent_minor"`
			TenantName  string `json:"tenant_name"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &list))
	require.Equal(t, 1, len(list.Data))
	require.Equal(t, "ACTIVE", list.Data[0].Status)
}
