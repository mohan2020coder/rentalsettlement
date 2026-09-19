package properties

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/response"
)

// Handler exposes property endpoints.
type Handler struct {
	svc *Service
}

// NewHandler builds the property handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Create handles POST /api/v1/properties.
func (h *Handler) Create(c *gin.Context) {
	var req CreatePropertyRequest
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

// List handles GET /api/v1/properties.
func (h *Handler) List(c *gin.Context) {
	list, err := h.svc.List(c.Request.Context(), authctx.UserID(c))
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, list, nil)
}

// Get handles GET /api/v1/properties/:id.
func (h *Handler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_ID", "Invalid property id", nil)
		return
	}
	dto, err := h.svc.Get(c.Request.Context(), authctx.UserID(c), id)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, dto, nil)
}

// Update handles PATCH /api/v1/properties/:id.
func (h *Handler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_ID", "Invalid property id", nil)
		return
	}
	var req UpdatePropertyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	dto, err := h.svc.Update(c.Request.Context(), authctx.UserID(c), id, req)
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
