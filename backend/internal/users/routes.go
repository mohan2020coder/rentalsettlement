package users

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/response"
)

// Handler exposes user endpoints.
type Handler struct {
	svc *Service
}

// NewHandler builds the user handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Me handles GET /api/v1/users/me.
func (h *Handler) Me(c *gin.Context) {
	dto, err := h.svc.Me(c.Request.Context(), authctx.UserID(c))
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, dto, nil)
}

// UpdateProfile handles PATCH /api/v1/users/me.
func (h *Handler) UpdateProfile(c *gin.Context) {
	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	dto, err := h.svc.UpdateProfile(c.Request.Context(), authctx.UserID(c), req)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, dto, nil)
}

// RegisterRoutes wires the authenticated user routes.
func RegisterRoutes(group *gin.RouterGroup, svc *Service) {
	h := NewHandler(svc)
	g := group.Group("/users")
	g.GET("/me", h.Me)
	g.PATCH("/me", h.UpdateProfile)
}
