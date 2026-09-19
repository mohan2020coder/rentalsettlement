package settlements

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/response"
)

// Handler exposes settlement endpoints.
type Handler struct {
	svc *Service
}

// NewHandler builds the settlement handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Generate handles POST /api/v1/settlements/tenancy/:tenancyID.
func (h *Handler) Generate(c *gin.Context) {
	tenancyID, ok := idParam(c, "tenancyID")
	if !ok {
		return
	}
	var req GenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	set, err := h.svc.Generate(c.Request.Context(), authctx.UserID(c), tenancyID, req)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.Created(c, set)
}

// Get handles GET /api/v1/settlements/tenancy/:tenancyID.
func (h *Handler) Get(c *gin.Context) {
	tenancyID, ok := idParam(c, "tenancyID")
	if !ok {
		return
	}
	set, err := h.svc.Get(c.Request.Context(), authctx.UserID(c), tenancyID)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, set, nil)
}

// Confirm handles POST /api/v1/settlements/tenancy/:tenancyID/confirm.
func (h *Handler) Confirm(c *gin.Context) {
	tenancyID, ok := idParam(c, "tenancyID")
	if !ok {
		return
	}
	set, err := h.svc.Confirm(c.Request.Context(), authctx.UserID(c), tenancyID)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, set, nil)
}

func idParam(c *gin.Context, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(name))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_ID", "Invalid id", nil)
		return uuid.Nil, false
	}
	return id, true
}
