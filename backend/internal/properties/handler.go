package properties

import (
	"fmt"
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

// ListListed handles GET /api/v1/properties/listed.
func (h *Handler) ListListed(c *gin.Context) {
	var maxRent *int64
	if v := c.Query("max_rent_minor"); v != "" {
		if n, err := parseInt64(v); err == nil {
			maxRent = &n
		}
	}
	var bedrooms *int
	if v := c.Query("bedrooms"); v != "" {
		if n, err := parseInt(v); err == nil {
			bedrooms = &n
		}
	}
	list, err := h.svc.ListListed(c.Request.Context(), ListingFilter{
		City:         c.Query("city"),
		MaxRentMinor: maxRent,
		Bedrooms:     bedrooms,
		Furnishing:   c.Query("furnishing_status"),
	})
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

func parseInt(v string) (int, error) {
	var n int
	_, err := fmt.Sscanf(v, "%d", &n)
	return n, err
}

func parseInt64(v string) (int64, error) {
	var n int64
	_, err := fmt.Sscanf(v, "%d", &n)
	return n, err
}
