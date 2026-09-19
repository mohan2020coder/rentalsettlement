package evidence

import (
	"bytes"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/response"
)

// Handler exposes the dossier download endpoint.
type Handler struct {
	svc *Service
}

// NewHandler builds the evidence handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Download handles GET /api/v1/evidence/tenancy/:tenancyID/download.
func (h *Handler) Download(c *gin.Context) {
	id, err := uuid.Parse(c.Param("tenancyID"))
	if err != nil {
		response.Error(c, 400, "INVALID_ID", "Invalid id", nil)
		return
	}
	pdf, filename, err := h.svc.Generate(c.Request.Context(), authctx.UserID(c), id)
	if err != nil {
		response.Abort(c, err)
		return
	}
	c.Header("Content-Disposition", `attachment; filename="`+filename+`"`)
	c.Data(200, "application/pdf", bytes.TrimSpace(pdf))
}
