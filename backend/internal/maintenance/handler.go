package maintenance

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/response"
	"rental-settlement/backend/pkg/validator"
)

// Handler exposes maintenance endpoints.
type Handler struct {
	svc *Service
}

// NewHandler builds the maintenance handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Report handles POST /api/v1/maintenance/tenancy/:tenancyID.
func (h *Handler) Report(c *gin.Context) {
	tenancyID, ok := idParam(c, "tenancyID")
	if !ok {
		return
	}
	var req ReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	if err := validator.OneOf("category", req.Category, CatPlumbing, CatElectrical, CatAppliance, CatStructural, CatCleaning, CatOther); err != nil {
		response.Error(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request", map[string]any{"category": err.Error()})
		return
	}
	if err := validator.OneOf("priority", req.Priority, PriorityLow, PriorityMedium, PriorityHigh, PriorityUrgent); err != nil {
		response.Error(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request", map[string]any{"priority": err.Error()})
		return
	}
	m, err := h.svc.Report(c.Request.Context(), authctx.UserID(c), tenancyID, req)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.Created(c, m)
}

// List handles GET /api/v1/maintenance/tenancy/:tenancyID.
func (h *Handler) List(c *gin.Context) {
	tenancyID, ok := idParam(c, "tenancyID")
	if !ok {
		return
	}
	list, err := h.svc.List(c.Request.Context(), authctx.UserID(c), tenancyID)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, list, nil)
}

// Get handles GET /api/v1/maintenance/:id.
func (h *Handler) Get(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	m, err := h.svc.Get(c.Request.Context(), authctx.UserID(c), id)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, m, nil)
}

// UpdateStatus handles POST /api/v1/maintenance/:id/status.
func (h *Handler) UpdateStatus(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	if err := validator.OneOf("status", req.Status, StatusOpen, StatusAcknowledged, StatusInProgress, StatusResolved, StatusRejected); err != nil {
		response.Error(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request", map[string]any{"status": err.Error()})
		return
	}
	m, err := h.svc.UpdateStatus(c.Request.Context(), authctx.UserID(c), id, req.Status, req.Comment)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, m, nil)
}

// AddComment handles POST /api/v1/maintenance/:id/comments.
func (h *Handler) AddComment(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	var req struct {
		Body string `json:"body"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	comment, err := h.svc.AddComment(c.Request.Context(), authctx.UserID(c), id, req.Body)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.Created(c, comment)
}

// AddMedia handles POST /api/v1/maintenance/:id/media.
func (h *Handler) AddMedia(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	var req AddMediaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	media, err := h.svc.AddMedia(c.Request.Context(), authctx.UserID(c), id, req)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.Created(c, media)
}

// GetComments handles GET /api/v1/maintenance/:id/comments.
func (h *Handler) GetComments(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	m, err := h.svc.Get(c.Request.Context(), authctx.UserID(c), id)
	if err != nil {
		response.Abort(c, err)
		return
	}
	list, err := h.svc.repo.Comments(c.Request.Context(), m.ID)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, list, nil)
}

func idParam(c *gin.Context, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(name))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_ID", "Invalid id", nil)
		return uuid.Nil, false
	}
	return id, true
}
