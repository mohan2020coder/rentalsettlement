package tests

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"rental-settlement/backend/internal/server"
)

// moveOutTenancy drives a tenancy into MOVE_OUT: create + confirm move-out
// inspection, both parties confirm.
func moveOutTenancy(t *testing.T, app *server.App, landlordAccess, tenantAccess, tenancyID string) {
	t.Helper()
	resp := Perform(app, http.MethodPost, "/api/v1/inspections/tenancy/"+tenancyID+"/move-out", `{"notes":"Moving out"}`, tenantAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var out struct {
		Data struct {
			ID string `json:"id"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &out))
	inspectionID := out.Data.ID

	resp = Perform(app, http.MethodPost, "/api/v1/inspections/"+inspectionID+"/confirm", "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	resp = Perform(app, http.MethodPost, "/api/v1/inspections/"+inspectionID+"/confirm", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	// Tenancy should be MOVE_OUT now.
	resp = Perform(app, http.MethodGet, "/api/v1/tenancies/"+tenancyID, "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var ten struct {
		Data struct {
			Status string `json:"status"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &ten))
	require.Equal(t, "MOVE_OUT", ten.Data.Status)
}

func TestDeductionAcceptFlow(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	landlordAccess, tenantAccess, tenancyID := setupParties(t, app)
	acceptTenancy(t, app, tenancyID, tenantAccess)
	moveOutTenancy(t, app, landlordAccess, tenantAccess, tenancyID)

	// Landlord proposes a deduction.
	resp := Perform(app, http.MethodPost, "/api/v1/deductions/tenancy/"+tenancyID, `{"category":"PROPERTY_DAMAGE","title":"Scratched wardrobe","claimed_amount_minor":250000,"currency":"INR"}`, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var claim struct {
		Data struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &claim))
	require.Equal(t, "PROPOSED", claim.Data.Status)
	claimID := claim.Data.ID

	// Tenant cannot propose.
	resp = Perform(app, http.MethodPost, "/api/v1/deductions/tenancy/"+tenancyID, `{"category":"OTHER","title":"Nope","claimed_amount_minor":100}`, tenantAccess)
	require.Equal(t, http.StatusForbidden, resp.Code, readBody(resp))

	// Tenant accepts the full claim.
	resp = Perform(app, http.MethodPost, "/api/v1/deductions/"+claimID+"/accept", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var agreed struct {
		Data struct {
			Status string `json:"status"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &agreed))
	require.Equal(t, "AGREED", agreed.Data.Status)

	// Claim is immutable after agreement.
	resp = Perform(app, http.MethodPost, "/api/v1/deductions/"+claimID+"/accept", "", tenantAccess)
	require.Equal(t, http.StatusBadRequest, resp.Code, readBody(resp))
}

func TestDisputeNegotiationFlow(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	landlordAccess, tenantAccess, tenancyID := setupParties(t, app)
	acceptTenancy(t, app, tenancyID, tenantAccess)
	moveOutTenancy(t, app, landlordAccess, tenantAccess, tenancyID)

	// Landlord proposes a deduction.
	resp := Perform(app, http.MethodPost, "/api/v1/deductions/tenancy/"+tenancyID, `{"category":"CLEANING","title":"Deep cleaning","claimed_amount_minor":100000,"currency":"INR"}`, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var claim struct {
		Data struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &claim))
	claimID := claim.Data.ID

	// Tenant disputes it.
	resp = Perform(app, http.MethodPost, "/api/v1/deductions/"+claimID+"/dispute", `{"reason":"Apartment was left clean"}`, tenantAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var dispute struct {
		Data struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &dispute))
	disputeID := dispute.Data.ID
	require.Equal(t, "OPEN", dispute.Data.Status)

	// Claim now disputed.
	resp = Perform(app, http.MethodGet, "/api/v1/deductions/"+claimID, "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var disputed struct {
		Data struct {
			Status string `json:"status"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &disputed))
	require.Equal(t, "DISPUTED", disputed.Data.Status)

	// Landlord counter-offers a lower amount.
	resp = Perform(app, http.MethodPost, "/api/v1/disputes/"+disputeID+"/counter-offer", `{"new_amount_minor":50000,"reason":"Reduced as a gesture"}`, landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	// Tenant accepts the counter-offer, resolving negotiation.
	resp = Perform(app, http.MethodPost, "/api/v1/disputes/"+disputeID+"/accept", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var resolvedClaim struct {
		Data struct {
			Status             string `json:"status"`
			ClaimedAmountMinor int64  `json:"claimed_amount_minor"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &resolvedClaim))
	require.Equal(t, "AGREED", resolvedClaim.Data.Status)
	require.Equal(t, int64(50000), resolvedClaim.Data.ClaimedAmountMinor)
}

func TestDisputeWithdrawFlow(t *testing.T) {
	app, _, cleanup := NewTestApp(t)
	defer cleanup()

	landlordAccess, tenantAccess, tenancyID := setupParties(t, app)
	acceptTenancy(t, app, tenancyID, tenantAccess)
	moveOutTenancy(t, app, landlordAccess, tenantAccess, tenancyID)

	resp := Perform(app, http.MethodPost, "/api/v1/deductions/tenancy/"+tenancyID, `{"category":"OTHER","title":"Misc","claimed_amount_minor":10000,"currency":"INR"}`, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var claim struct {
		Data struct {
			ID string `json:"id"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &claim))

	resp = Perform(app, http.MethodPost, "/api/v1/deductions/"+claim.Data.ID+"/dispute", `{"reason":"Disagreeing"}`, tenantAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var dispute struct {
		Data struct {
			ID string `json:"id"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &dispute))

	// Tenant withdraws the dispute.
	resp = Perform(app, http.MethodPost, "/api/v1/disputes/"+dispute.Data.ID+"/withdraw", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	// Claim goes back to PROPOSED.
	resp = Perform(app, http.MethodGet, "/api/v1/deductions/"+claim.Data.ID, "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var back struct {
		Data struct {
			Status string `json:"status"`
		}
	}
	require.NoError(t, json.Unmarshal([]byte(readBody(resp)), &back))
	require.Equal(t, "PROPOSED", back.Data.Status)
}
