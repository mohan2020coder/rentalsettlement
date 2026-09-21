package tenancies

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/response"
)

// Handler exposes tenancy endpoints.
type Handler struct {
	svc *Service
}

// NewHandler builds the tenancy handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Create handles POST /api/v1/tenancies.
func (h *Handler) Create(c *gin.Context) {
	var req CreateTenancyRequest
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

// List handles GET /api/v1/tenancies.
func (h *Handler) List(c *gin.Context) {
	list, err := h.svc.List(c.Request.Context(), authctx.UserID(c))
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, list, nil)
}

// Get handles GET /api/v1/tenancies/:id.
func (h *Handler) Get(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	dto, err := h.svc.Get(c.Request.Context(), authctx.UserID(c), id)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, toDTO(dto), nil)
}

// Accept handles POST /api/v1/tenancies/:id/accept.
func (h *Handler) Accept(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	dto, err := h.svc.Accept(c.Request.Context(), authctx.UserID(c), id)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, dto, nil)
}

// UpdateStatus handles POST /api/v1/tenancies/:id/status.
func (h *Handler) UpdateStatus(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	dto, err := h.svc.UpdateStatus(c.Request.Context(), authctx.UserID(c), id, strings.ToUpper(req.Status))
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
