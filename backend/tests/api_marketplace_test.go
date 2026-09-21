package tests

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"rental-settlement/backend/seeds"
)

func TestMarketplaceFlow(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	lName, lEmail := landlordUser()
	landlordAccess, _, _ := RegisterAndLogin(t, app, lName, lEmail, "password123", "LANDLORD")
	_, tEmail := tenantUser()
	tenantAccess, _, _ := RegisterAndLogin(t, app, "Arun Verma", tEmail, "password123", "TENANT")

	// Landlord creates a property and lists it on the catalog with rent terms.
	propertyID := createPropertyForLandlord(t, app, landlordAccess)
	resp := Perform(app, http.MethodPatch, "/api/v1/properties/"+propertyID, `{"listed":true,"monthly_rent_minor":3500000,"security_deposit_minor":10000000,"currency":"INR"}`, landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	var catalog struct {
		Data []struct {
			ID               string `json:"id"`
			MonthlyRentMinor int64  `json:"monthly_rent_minor"`
		}
	}

	// Tenant browses the catalog and sees only listed, ACTIVE properties.
	resp = Perform(app, http.MethodGet, "/api/v1/properties/listed?max_rent_minor=4000000", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &catalog))
	require.Equal(t, 1, len(catalog.Data))
	require.Equal(t, propertyID, catalog.Data[0].ID)
	require.Equal(t, int64(3500000), catalog.Data[0].MonthlyRentMinor)

	// Tenant sends a visit request with a preferred date and note.
	resp = Perform(app, http.MethodPost, "/api/v1/applications", fmt.Sprintf(`{"property_id":%q,"preferred_date":"2026-10-05","note":"Flexible on weekends"}`, propertyID), tenantAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var created struct {
		Data struct {
			ID            string `json:"id"`
			Status        string `json:"status"`
			PropertyName  string `json:"property_name"`
			PreferredDate string `json:"preferred_date"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &created))
	require.Equal(t, "PENDING", created.Data.Status)
	require.Equal(t, "Test Flat", created.Data.PropertyName)
	applicationID := created.Data.ID

	// A duplicate pending request is rejected.
	resp = Perform(app, http.MethodPost, "/api/v1/applications", fmt.Sprintf(`{"property_id":%q}`, propertyID), tenantAccess)
	require.Equal(t, http.StatusConflict, resp.Code, readBody(resp))

	// Non-tenants cannot apply.
	resp = Perform(app, http.MethodPost, "/api/v1/applications", fmt.Sprintf(`{"property_id":%q}`, propertyID), landlordAccess)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))

	// Landlord sees the pending request.
	resp = Perform(app, http.MethodGet, "/api/v1/applications", "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var landlordList struct {
		Data []struct {
			ID          string `json:"id"`
			TenantEmail string `json:"tenant_email"`
			Status      string `json:"status"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &landlordList))
	require.Equal(t, 1, len(landlordList.Data))
	require.Equal(t, tEmail, landlordList.Data[0].TenantEmail)

	// A different landlord cannot decide on it.
	otherLandlordAccess, _, _ := RegisterAndLogin(t, app, "Other Landlord", uniqueEmail("landlord2"), "password123", "LANDLORD")
	resp = Perform(app, http.MethodPost, "/api/v1/applications/"+applicationID+"/approve", `{}`, otherLandlordAccess)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))

	// Landlord rejects, then the tenant can apply again.
	resp = Perform(app, http.MethodPost, "/api/v1/applications/"+applicationID+"/reject", `{}`, landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	resp = Perform(app, http.MethodPost, "/api/v1/applications", fmt.Sprintf(`{"property_id":%q}`, propertyID), tenantAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var second struct {
		Data struct {
			ID string `json:"id"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &second))
	applicationID = second.Data.ID

	// Approving creates an in-app tenancy invitation and unlists the property.
	resp = Perform(app, http.MethodPost, "/api/v1/applications/"+applicationID+"/approve", `{}`, landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var approved struct {
		Data struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &approved))
	require.Equal(t, "APPROVED", approved.Data.Status)

	resp = Perform(app, http.MethodGet, "/api/v1/properties/listed", "", tenantAccess)
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &catalog))
	require.Equal(t, 0, len(catalog.Data))

	// The tenant sees an INVITED tenancy and accepts it in-app.
	resp = Perform(app, http.MethodGet, "/api/v1/tenancies", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var tenancies struct {
		Data []struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &tenancies))
	require.Equal(t, 1, len(tenancies.Data))
	require.Equal(t, "INVITED", tenancies.Data[0].Status)
	tenancyID := tenancies.Data[0].ID

	resp = Perform(app, http.MethodPost, "/api/v1/tenancies/"+tenancyID+"/accept", `{}`, tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	// Approving also placed the first rental agreement version up front with
	// the invited terms, so the tenant reviews it alongside the invitation.
	resp = Perform(app, http.MethodGet, "/api/v1/agreements/tenancy/"+tenancyID+"/current", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var agreement struct {
		Data struct {
			VersionNumber int `json:"version_number"`
			Terms         struct {
				MonthlyRentMinor     int64 `json:"monthly_rent_minor"`
				SecurityDepositMinor int64 `json:"security_deposit_minor"`
				MonthlyPaymentDay    int   `json:"monthly_payment_day"`
				NoticePeriodDays     int   `json:"notice_period_days"`
			} `json:"terms"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &agreement))
	require.Equal(t, 1, agreement.Data.VersionNumber)
	require.Equal(t, int64(3500000), agreement.Data.Terms.MonthlyRentMinor)
	require.Equal(t, int64(10000000), agreement.Data.Terms.SecurityDepositMinor)
	require.Equal(t, 5, agreement.Data.Terms.MonthlyPaymentDay)
	require.Equal(t, 30, agreement.Data.Terms.NoticePeriodDays)

	// The application can no longer be approved once decided.
	resp = Perform(app, http.MethodPost, "/api/v1/applications/"+applicationID+"/approve", `{}`, landlordAccess)
	require.Equal(t, http.StatusBadRequest, resp.Code, readBody(resp))

	// A second landlord's property only appears once it is listed; the tenant
	// can withdraw a request against it via cancel.
	otherID := createPropertyForLandlord(t, app, otherLandlordAccess)
	resp = Perform(app, http.MethodGet, "/api/v1/properties/listed", "", tenantAccess)
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &catalog))
	require.Equal(t, 0, len(catalog.Data))

	resp = Perform(app, http.MethodPatch, "/api/v1/properties/"+otherID, `{"listed":true,"monthly_rent_minor":5000000,"security_deposit_minor":15000000,"currency":"INR"}`, otherLandlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	resp = Perform(app, http.MethodGet, "/api/v1/properties/listed", "", tenantAccess)
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &catalog))
	require.Equal(t, 1, len(catalog.Data))
	require.Equal(t, otherID, catalog.Data[0].ID)

	resp = Perform(app, http.MethodPost, "/api/v1/applications", fmt.Sprintf(`{"property_id":%q}`, otherID), tenantAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var third struct {
		Data struct {
			ID string `json:"id"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &third))
	resp = Perform(app, http.MethodPost, "/api/v1/applications/"+third.Data.ID+"/cancel", `{}`, tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
}

func TestSeedMarketplaceListed(t *testing.T) {
	app, db, cleanup := NewTestApp(t)
	defer cleanup()

	require.NoError(t, seeds.SeedDemo(context.Background(), db))
	require.NoError(t, seeds.SeedMarketplaceDemo(context.Background(), db))
	require.NoError(t, seeds.SeedMarketplaceDemo(context.Background(), db))

	tName, tEmail := tenantUser()
	tenantAccess, _, _ := RegisterAndLogin(t, app, tName, tEmail, "password123", "TENANT")

	resp := Perform(app, http.MethodGet, "/api/v1/properties/listed", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var catalog struct {
		Data []struct {
			ID           string `json:"id"`
			PropertyName string `json:"property_name"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &catalog))
	require.Equal(t, 1, len(catalog.Data))
	require.Equal(t, "Sunrise Studio, 1BHK", catalog.Data[0].PropertyName)
}