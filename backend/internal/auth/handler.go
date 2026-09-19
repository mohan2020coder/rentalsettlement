package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/response"
)

// Handler exposes auth endpoints.
type Handler struct {
	svc *Service
}

// NewHandler builds the auth handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Register handles POST /api/v1/auth/register.
func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	resp, err := h.svc.Register(c.Request.Context(), req)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.Created(c, resp)
}

// Login handles POST /api/v1/auth/login.
func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	resp, err := h.svc.Login(c.Request.Context(), req)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, resp, nil)
}

// Refresh handles POST /api/v1/auth/refresh.
func (h *Handler) Refresh(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	resp, err := h.svc.Refresh(c.Request.Context(), req)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, resp, nil)
}

// Logout handles POST /api/v1/auth/logout.
func (h *Handler) Logout(c *gin.Context) {
	var req LogoutRequest
	_ = c.ShouldBindJSON(&req)
	if err := h.svc.Logout(c.Request.Context(), authctx.UserID(c), req.RefreshToken); err != nil {
		response.Abort(c, err)
		return
	}
	response.NoContent(c)
}
