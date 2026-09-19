package tests

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestAuthRegisterSuccess(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	access, refresh, userID := RegisterAndLogin(t, app, "Rajesh", "rajesh@example.com", "password123", "LANDLORD")
	require.NotEmpty(t, access)
	require.NotEmpty(t, refresh)
	require.NotEqual(t, uuid.Nil, userID)
}

func TestAuthRegisterDuplicateEmail(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	RegisterAndLogin(t, app, "A", "dup@example.com", "password123", "TENANT")

	body := `{"name":"B","email":"DUP@example.com","password":"password123","role":"TENANT"}`
	resp := Perform(app, http.MethodPost, "/api/v1/auth/register", body, "")
	require.Equal(t, http.StatusConflict, resp.Code)
	require.Contains(t, readBody(resp), "EMAIL_TAKEN")
}

func TestAuthRegisterValidation(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	cases := []string{
		`{"email":"bad","password":"x","role":"LANDLORD"}`,
		`{"name":"X","email":"a@b.com","password":"short","role":"ADMIN"}`,
		`{}`,
	}
	for _, body := range cases {
		resp := Perform(app, http.MethodPost, "/api/v1/auth/register", body, "")
		responseBody := readBody(resp)
		require.Equal(t, http.StatusBadRequest, resp.Code, responseBody)
		require.Contains(t, responseBody, "VALIDATION_ERROR")
	}
}

func TestAuthLogin(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	RegisterAndLogin(t, app, "Arun", "arun@example.com", "password123", "TENANT")

	body := fmt.Sprintf(`{"email":"arun@example.com","password":"password123"}`)
	resp := Perform(app, http.MethodPost, "/api/v1/auth/login", body, "")
	require.Equal(t, http.StatusOK, resp.Code)
	require.Contains(t, readBody(resp), "access_token")
}

func TestAuthLoginInvalidCredentials(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	RegisterAndLogin(t, app, "Arun", "arun@example.com", "password123", "TENANT")

	body := `{"email":"arun@example.com","password":"wrongpass"}`
	resp := Perform(app, http.MethodPost, "/api/v1/auth/login", body, "")
	require.Equal(t, http.StatusUnauthorized, resp.Code)
	require.Contains(t, readBody(resp), "INVALID_CREDENTIALS")
}

func TestAuthMe(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	access, _, _ := RegisterAndLogin(t, app, "Rajesh", "rajesh@example.com", "password123", "LANDLORD")

	resp := Perform(app, http.MethodGet, "/api/v1/users/me", nil, access)
	require.Equal(t, http.StatusOK, resp.Code)
	require.Contains(t, readBody(resp), `"role":"LANDLORD"`)

	// No token -> 401
	resp = Perform(app, http.MethodGet, "/api/v1/users/me", nil, "")
	require.Equal(t, http.StatusUnauthorized, resp.Code)

	// Garbage token -> 401
	resp = Perform(app, http.MethodGet, "/api/v1/users/me", nil, "not.a.token")
	require.Equal(t, http.StatusUnauthorized, resp.Code)
}

func TestAuthRefreshRotation(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	_, refresh, _ := RegisterAndLogin(t, app, "Arun", "arun@example.com", "password123", "TENANT")

	body := fmt.Sprintf(`{"refresh_token":%q}`, refresh)
	resp := Perform(app, http.MethodPost, "/api/v1/auth/refresh", body, "")
	require.Equal(t, http.StatusOK, resp.Code)

	newRefresh := mustData[struct {
		RefreshToken string `json:"refresh_token"`
	}](resp).RefreshToken
	require.NotEmpty(t, newRefresh)

	// Reusing the old refresh token must fail (rotation).
	resp = Perform(app, http.MethodPost, "/api/v1/auth/refresh", body, "")
	require.Equal(t, http.StatusUnauthorized, resp.Code)
}

func TestAuthLogoutRevokesRefresh(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	access, refresh, _ := RegisterAndLogin(t, app, "Arun", "arun@example.com", "password123", "TENANT")

	body := fmt.Sprintf(`{"refresh_token":%q}`, refresh)
	resp := Perform(app, http.MethodPost, "/api/v1/auth/logout", body, access)
	require.Equal(t, http.StatusNoContent, resp.Code)

	// Refresh must now fail.
	resp = Perform(app, http.MethodPost, "/api/v1/auth/refresh", body, "")
	require.Equal(t, http.StatusUnauthorized, resp.Code)
}

func TestAuthRegistrationGetsFreePlan(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	access, _, _ := RegisterAndLogin(t, app, "Rajesh", "rajesh@example.com", "password123", "LANDLORD")

	resp := Perform(app, http.MethodGet, "/api/v1/billing/subscription", nil, access)
	require.Equal(t, http.StatusOK, resp.Code)
	body := readBody(resp)
	require.Contains(t, body, `"code":"FREE"`)
}

func TestMeRequiresAuthz(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	// Wrong-role token should not matter: only the JWT is checked for /me.
	access, _, _ := RegisterAndLogin(t, app, "Tenant", "t@example.com", "password123", "TENANT")
	resp := Perform(app, http.MethodGet, "/api/v1/users/me", nil, access)
	require.Equal(t, http.StatusOK, resp.Code)
	require.Contains(t, readBody(resp), `"role":"TENANT"`)
}
