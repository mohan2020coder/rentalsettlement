package applications

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/response"
)

// Handler exposes application endpoints.
type Handler struct {
	svc *Service
}

// NewHandler builds the application handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Create handles POST /api/v1/applications.
func (h *Handler) Create(c *gin.Context) {
	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	dto, err := h.svc.Create(c.Request.Context(), authctx.UserID(c), req)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.Created(c, dto)
}

// List handles GET /api/v1/applications.
func (h *Handler) List(c *gin.Context) {
	list, err := h.svc.List(c.Request.Context(), authctx.UserID(c))
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, list, nil)
}

// Cancel handles POST /api/v1/applications/:id/cancel.
func (h *Handler) Cancel(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	dto, err := h.svc.Cancel(c.Request.Context(), authctx.UserID(c), id)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, dto, nil)
}

// Approve handles POST /api/v1/applications/:id/approve.
func (h *Handler) Approve(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	dto, err := h.svc.Approve(c.Request.Context(), authctx.UserID(c), id)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, dto, nil)
}

// Reject handles POST /api/v1/applications/:id/reject.
func (h *Handler) Reject(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	dto, err := h.svc.Reject(c.Request.Context(), authctx.UserID(c), id)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, dto, nil)
}

func parseID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_ID", "Invalid id", nil)
		return uuid.Nil, false
	}
	return id, true
}
