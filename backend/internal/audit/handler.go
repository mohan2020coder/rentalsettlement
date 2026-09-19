package audit

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/response"
)

// Handler exposes audit-list endpoints.
type Handler struct {
	svc *Service
}

// NewHandler builds the audit handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// MyLog handles GET /api/v1/audit/me.
func (h *Handler) MyLog(c *gin.Context) {
	logs, err := h.svc.ListByActor(c.Request.Context(), authctx.UserID(c), 100)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, logs, nil)
}

// TenancyLog handles GET /api/v1/audit/tenancy/:tenancyID.
func (h *Handler) TenancyLog(c *gin.Context) {
	id, err := uuid.Parse(c.Param("tenancyID"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_ID", "Invalid id", nil)
		return
	}
	logs, err := h.svc.ListByTenancy(c.Request.Context(), id)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, logs, nil)
}
