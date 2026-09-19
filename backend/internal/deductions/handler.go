package deductions

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/response"
	"rental-settlement/backend/pkg/validator"
)

// Handler exposes deduction-claim and dispute endpoints.
type Handler struct {
	svc *Service
	cat []string
}

// NewHandler builds the deductions handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc, cat: []string{CategoryUnpaidRent, CategoryUtility, CategoryPropertyDamage, CategoryMissingItem, CategoryCleaning, CategoryOther}}
}

// Propose handles POST /api/v1/deductions/tenancy/:tenancyID.
func (h *Handler) Propose(c *gin.Context) {
	tenancyID, ok := idParam(c, "tenancyID")
	if !ok {
		return
	}
	var req ProposeClaimRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	if err := validator.OneOf("category", req.Category, h.cat...); err != nil {
		response.Error(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request", map[string]any{"category": err.Error()})
		return
	}
	claim, err := h.svc.Propose(c.Request.Context(), authctx.UserID(c), tenancyID, req)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.Created(c, claim)
}

// List handles GET /api/v1/deductions/tenancy/:tenancyID.
func (h *Handler) List(c *gin.Context) {
	tenancyID, ok := idParam(c, "tenancyID")
	if !ok {
		return
	}
	list, err := h.svc.List(c.Request.Context(), authctx.UserID(c), tenancyID)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, list, nil)
}

// Get handles GET /api/v1/deductions/:id.
func (h *Handler) Get(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	claim, err := h.svc.Get(c.Request.Context(), authctx.UserID(c), id)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, claim, nil)
}

// Accept handles POST /api/v1/deductions/:id/accept.
func (h *Handler) Accept(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	claim, err := h.svc.Accept(c.Request.Context(), authctx.UserID(c), id)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, claim, nil)
}

// Dispute handles POST /api/v1/deductions/:id/dispute.
func (h *Handler) Dispute(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	var req DisputeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	d, err := h.svc.Dispute(c.Request.Context(), authctx.UserID(c), id, req)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.Created(c, d)
}

// Withdraw handles POST /api/v1/deductions/:id/withdraw.
func (h *Handler) Withdraw(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	claim, err := h.svc.Withdraw(c.Request.Context(), authctx.UserID(c), id, "")
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, claim, nil)
}

// DisputeList handles GET /api/v1/disputes/tenancy/:tenancyID.
func (h *Handler) DisputeList(c *gin.Context) {
	tenancyID, ok := idParam(c, "tenancyID")
	if !ok {
		return
	}
	list, err := h.svc.DisputeList(c.Request.Context(), authctx.UserID(c), tenancyID)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, list, nil)
}

// DisputeGet handles GET /api/v1/disputes/:id.
func (h *Handler) DisputeGet(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	d, events, err := h.svc.DisputeGet(c.Request.Context(), authctx.UserID(c), id)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, gin.H{"dispute": d, "events": events}, nil)
}

// DisputeAccept handles POST /api/v1/disputes/:id/accept.
func (h *Handler) DisputeAccept(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	claim, err := h.svc.DisputeAccept(c.Request.Context(), authctx.UserID(c), id)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, claim, nil)
}

// CounterOffer handles POST /api/v1/disputes/:id/counter-offer.
func (h *Handler) CounterOffer(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	var req CounterOfferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	d, err := h.svc.CounterOffer(c.Request.Context(), authctx.UserID(c), id, req)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, d, nil)
}

// DisputeWithdraw handles POST /api/v1/disputes/:id/withdraw.
func (h *Handler) DisputeWithdraw(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	d, err := h.svc.DisputeWithdraw(c.Request.Context(), authctx.UserID(c), id, "")
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, d, nil)
}

func idParam(c *gin.Context, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(name))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_ID", "Invalid id", nil)
		return uuid.Nil, false
	}
	return id, true
}
