package notifications

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/response"
)

// Handler exposes notification endpoints.
type Handler struct {
	svc *Service
}

// NewHandler builds the notification handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// List handles GET /api/v1/notifications.
func (h *Handler) List(c *gin.Context) {
	list, err := h.svc.List(c.Request.Context(), authctx.UserID(c), 50)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, list, nil)
}

// MarkRead handles POST /api/v1/notifications/:id/read.
func (h *Handler) MarkRead(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_ID", "Invalid id", nil)
		return
	}
	if err := h.svc.MarkRead(c.Request.Context(), authctx.UserID(c), id); err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, gin.H{"status": "read"}, nil)
}

// MarkAllRead handles POST /api/v1/notifications/read-all.
func (h *Handler) MarkAllRead(c *gin.Context) {
	if err := h.svc.MarkAllRead(c.Request.Context(), authctx.UserID(c)); err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, gin.H{"status": "read"}, nil)
}

// UnreadCount handles GET /api/v1/notifications/unread-count.
func (h *Handler) UnreadCount(c *gin.Context) {
	count, err := h.svc.UnreadCount(c.Request.Context(), authctx.UserID(c))
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, gin.H{"unread_count": count}, nil)
}
