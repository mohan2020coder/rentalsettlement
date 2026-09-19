package tests

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSettlementFullFlow(t *testing.T) {
	app, db, cleanup := NewTestApp(t)
	defer cleanup()

	landlordAccess, tenantAccess, tenancyID := setupParties(t, app)
	acceptTenancy(t, app, db, tenancyID, tenantAccess)
	moveOutTenancy(t, app, landlordAccess, tenantAccess, tenancyID)

	// Landlord raises a deduction and tenant agrees to a reduced part
	// through negotiation, reaching an AGREED claim.
	resp := Perform(app, http.MethodPost, "/api/v1/deductions/tenancy/"+tenancyID, `{"category":"PROPERTY_DAMAGE","title":"Damaged wardrobe","claimed_amount_minor":500000,"currency":"INR"}`, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var claim struct {
		Data struct{ ID string }
	}
	require.NoError(t, decode(resp, &claim))

	resp = Perform(app, http.MethodPost, "/api/v1/deductions/"+claim.Data.ID+"/dispute", `{"reason":"Fair wear and tear"}`, tenantAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var dispute struct {
		Data struct{ ID string }
	}
	require.NoError(t, decode(resp, &dispute))

	resp = Perform(app, http.MethodPost, "/api/v1/disputes/"+dispute.Data.ID+"/counter-offer", `{"new_amount_minor":50000,"reason":"Settle"}`, landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	resp = Perform(app, http.MethodPost, "/api/v1/disputes/"+dispute.Data.ID+"/accept", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	// Landlord generates the settlement.
	resp = Perform(app, http.MethodPost, "/api/v1/settlements/tenancy/"+tenancyID, `{"recorded_deposit_minor":10000000,"currency":"INR"}`, landlordAccess)
	require.Equal(t, http.StatusCreated, resp.Code, readBody(resp))
	var set struct {
		Data struct {
			Status               string `json:"status"`
			RecordedDepositMinor int64  `json:"recorded_deposit_minor"`
			TotalDeductionMinor  int64  `json:"total_deduction_minor"`
			RemainingAmountMinor int64  `json:"remaining_amount_minor"`
			Items                []struct {
				Title    string `json:"title"`
				Amount   int64  `json:"amount_minor"`
				Category string `json:"category"`
			} `json:"items"`
		}
	}
	require.NoError(t, decode(resp, &set))
	require.Equal(t, "DRAFT", set.Data.Status)
	require.Equal(t, int64(10000000), set.Data.RecordedDepositMinor)
	require.Equal(t, int64(50000), set.Data.TotalDeductionMinor)
	require.Equal(t, int64(9950000), set.Data.RemainingAmountMinor)
	require.Equal(t, 1, len(set.Data.Items))
	require.Equal(t, "Damaged wardrobe", set.Data.Items[0].Title)

	// Tenant confirms.
	resp = Perform(app, http.MethodPost, "/api/v1/settlements/tenancy/"+tenancyID+"/confirm", "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))

	// Both confirmed: settlement CONFIRMED and tenancy SETTLED.
	resp = Perform(app, http.MethodGet, "/api/v1/settlements/tenancy/"+tenancyID, "", tenantAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var final struct {
		Data struct {
			Status      string `json:"status"`
			ConfirmedAt string `json:"confirmed_at"`
		}
	}
	require.NoError(t, decode(resp, &final))
	require.Equal(t, "CONFIRMED", final.Data.Status)
	require.NotEmpty(t, final.Data.ConfirmedAt)

	resp = Perform(app, http.MethodGet, "/api/v1/tenancies/"+tenancyID, "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var ten struct {
		Data struct {
			Status string `json:"status"`
		}
	}
	require.NoError(t, decode(resp, &ten))
	require.Equal(t, "SETTLED", ten.Data.Status)

	// Active tenancy usage released.
	resp = Perform(app, http.MethodGet, "/api/v1/billing/usage", "", landlordAccess)
	require.Equal(t, http.StatusOK, resp.Code, readBody(resp))
	var usage struct {
		Data struct {
			ActiveTenancyCount int64 `json:"active_tenancy_count"`
		}
	}
	require.NoError(t, decode(resp, &usage))
	require.Equal(t, int64(0), usage.Data.ActiveTenancyCount)
}
