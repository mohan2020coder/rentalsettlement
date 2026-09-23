package tests

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func landlordUser() (name, email string) {
	return "Rajesh Kumar", uniqueEmail("rajesh")
}

func tenantUser() (name, email string) {
	return "Arun Verma", uniqueEmail("arun")
}

func TestPropertyLifecycle(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	name, email := landlordUser()
	landlordAccess, _, _ := RegisterAndLogin(t, app, name, email, "password123", "LANDLORD")

	createBody := fmt.Sprintf(`{
		"property_name": "3BHK Apartment, Koramangala",
		"property_type": "APARTMENT",
		"address_line1": "24, 8th Main",
		"locality": "Koramangala",
		"city": "Bangalore",
		"state": "Karnataka",
		"postal_code": "560034",
		"bedrooms": 3,
		"bathrooms": 2,
		"furnishing_status": "SEMI_FURNISHED"
	}`)
	resp := Perform(app, http.MethodPost, "/api/v1/properties", createBody, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var created struct {
		Data struct {
			ID           string `json:"id"`
			PropertyName string `json:"property_name"`
			Status       string `json:"status"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &created))
	require.NotEmpty(t, created.Data.ID)
	require.Equal(t, "3BHK Apartment, Koramangala", created.Data.PropertyName)
	require.Equal(t, "ACTIVE", created.Data.Status)

	// Tenant cannot create a property.
	tenantName, tenantEmail := tenantUser()
	tenantAccess, _, _ := RegisterAndLogin(t, app, tenantName, tenantEmail, "password123", "TENANT")
	resp = Perform(app, http.MethodPost, "/api/v1/properties", createBody, tenantAccess)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))

	// Landlord lists and fetches.
	resp = Perform(app, http.MethodGet, "/api/v1/properties", "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var list struct {
		Data []struct {
			ID string `json:"id"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &list))
	require.Equal(t, 1, len(list.Data))
	require.Equal(t, created.Data.ID, list.Data[0].ID)

	resp = Perform(app, http.MethodGet, "/api/v1/properties/"+created.Data.ID, "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	// Tenant cannot read the property.
	resp = Perform(app, http.MethodGet, "/api/v1/properties/"+created.Data.ID, "", tenantAccess)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))

	// Update the property.
	resp = Perform(app, http.MethodPatch, "/api/v1/properties/"+created.Data.ID, `{"property_name":"Renamed 3BHK"}`, landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var updated struct {
		Data struct {
			PropertyName string `json:"property_name"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &updated))
	require.Equal(t, "Renamed 3BHK", updated.Data.PropertyName)

	// Usage of PROPERTY_COUNT incremented.
	resp = Perform(app, http.MethodGet, "/api/v1/billing/usage", "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var usage struct {
		Data struct {
			PropertyCount int64 `json:"property_count"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &usage))
	require.Equal(t, int64(1), usage.Data.PropertyCount)
}

func TestPlanLimitReachedForProperties(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	name, email := landlordUser()
	landlordAccess, _, _ := RegisterAndLogin(t, app, name, email, "password123", "LANDLORD")

	// FREE plan allows 1 property. Creating a second must fail with PLAN_LIMIT_REACHED.
	body := `{"property_name":"First","property_type":"APARTMENT"}`
	resp := Perform(app, http.MethodPost, "/api/v1/properties", body, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))

	resp = Perform(app, http.MethodPost, "/api/v1/properties", body, landlordAccess)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))
	var errResp struct {
		Error struct {
			Code string `json:"code"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &errResp))
	require.Equal(t, "PLAN_LIMIT_REACHED", errResp.Error.Code)
}

func TestPropertyValidation(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	name, email := landlordUser()
	landlordAccess, _, _ := RegisterAndLogin(t, app, name, email, "password123", "LANDLORD")
	resp := Perform(app, http.MethodPost, "/api/v1/properties", `{"property_name":"","property_type":"WEIRD"}`, landlordAccess)
	require.Equal(t, http.StatusBadRequest, resp.Code, readBody(resp))
	require.Contains(t, readBody(resp), "VALIDATION_ERROR")
}

func TestPropertyPhotos(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	name, email := landlordUser()
	landlordAccess, _, _ := RegisterAndLogin(t, app, name, email, "password123", "LANDLORD")
	const createBody = `{
		"property_name": "Photo Test Villa",
		"property_type": "VILLA",
		"photo": "media/2026/09/cover.jpg",
		"photos": ["media/2026/09/cover.jpg", "media/2026/09/living.jpg", "media/2026/09/kitchen.jpg"]
	}`
	resp := Perform(app, http.MethodPost, "/api/v1/properties", createBody, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var created struct {
		Data struct {
			ID     string   `json:"id"`
			Photo  *string  `json:"photo"`
			Photos []string `json:"photos"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &created))
	require.Equal(t, "media/2026/09/cover.jpg", *created.Data.Photo)
	require.Equal(t, []string{"media/2026/09/cover.jpg", "media/2026/09/living.jpg", "media/2026/09/kitchen.jpg"}, created.Data.Photos)

	// Invalid photo keys are rejected.
	resp = Perform(app, http.MethodPost, "/api/v1/properties", `{"property_name":"Bad","property_type":"HOUSE","photos":["media/a/../../etc/passwd"]}`, landlordAccess)
	require.Equal(t, http.StatusBadRequest, resp.Code, readBody(resp))

	// Reorder/gallery replace keeps the cover in sync.
	resp = Perform(app, http.MethodPatch, "/api/v1/properties/"+created.Data.ID, `{"photos":["media/2026/09/roof.jpg","media/2026/09/yard.jpg"]}`, landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var updated struct {
		Data struct {
			Photo  *string  `json:"photo"`
			Photos []string `json:"photos"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &updated))
	require.Equal(t, "media/2026/09/roof.jpg", *updated.Data.Photo)
	require.Equal(t, []string{"media/2026/09/roof.jpg", "media/2026/09/yard.jpg"}, updated.Data.Photos)

	// GET returns the same gallery.
	resp = Perform(app, http.MethodGet, "/api/v1/properties/"+created.Data.ID, "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &updated))
	require.Equal(t, []string{"media/2026/09/roof.jpg", "media/2026/09/yard.jpg"}, updated.Data.Photos)

	// Clearing the gallery clears the cover too.
	resp = Perform(app, http.MethodPatch, "/api/v1/properties/"+created.Data.ID, `{"photos":[]}`, landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &updated))
	require.Nil(t, updated.Data.Photo)
	require.Equal(t, []string{}, updated.Data.Photos)
}
