package inspections

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/response"
	"rental-settlement/backend/pkg/validator"
)

// Handler exposes inspection endpoints.
type Handler struct {
	svc *Service
}

// NewHandler builds the inspection handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// CreateMoveIn handles POST /api/v1/inspections/tenancy/:tenancyID/move-in.
func (h *Handler) CreateMoveIn(c *gin.Context) {
	tenancyID, ok := idParam(c, "tenancyID")
	if !ok {
		return
	}
	var req CreateInspectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	insp, err := h.svc.CreateMoveIn(c.Request.Context(), authctx.UserID(c), tenancyID, req)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.Created(c, insp)
}

// CreateMoveOut handles POST /api/v1/inspections/tenancy/:tenancyID/move-out.
func (h *Handler) CreateMoveOut(c *gin.Context) {
	tenancyID, ok := idParam(c, "tenancyID")
	if !ok {
		return
	}
	var req CreateInspectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	insp, err := h.svc.CreateMoveOut(c.Request.Context(), authctx.UserID(c), tenancyID, req)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.Created(c, insp)
}

// List handles GET /api/v1/inspections/tenancy/:tenancyID.
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
	response.OK(c, toSummaries(list), nil)
}

// Template handles GET /api/v1/inspections/tenancy/:tenancyID/template.
// It previews the room/item checklist the unit profile would scaffold.
func (h *Handler) Template(c *gin.Context) {
	tenancyID, ok := idParam(c, "tenancyID")
	if !ok {
		return
	}
	tpl, err := h.svc.Template(c.Request.Context(), authctx.UserID(c), tenancyID, c.DefaultQuery("kind", KindMoveIn))
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, tpl, nil)
}

// Get handles GET /api/v1/inspections/:id.
func (h *Handler) Get(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	insp, err := h.svc.Get(c.Request.Context(), authctx.UserID(c), id)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, insp, nil)
}

// SaveItem handles PUT /api/v1/inspections/:id/rooms/:roomID/items/:itemID.
func (h *Handler) SaveItem(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	roomID, ok := idParam(c, "roomID")
	if !ok {
		return
	}
	itemID, ok := idParam(c, "itemID")
	if !ok {
		return
	}
	var req SaveItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	if req.Condition != "" {
		if err := validator.OneOf("condition", req.Condition, ConditionExcellent, ConditionGood, ConditionFair, ConditionDamaged, ConditionNotPresent); err != nil {
			response.Error(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request", map[string]any{"condition": err.Error()})
			return
		}
	}
	item, err := h.svc.SaveItem(c.Request.Context(), authctx.UserID(c), id, roomID, itemID, req)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, item, nil)
}

// AddMedia handles POST /api/v1/inspections/:id/media.
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

// Confirm handles POST /api/v1/inspections/:id/confirm.
func (h *Handler) Confirm(c *gin.Context) {
	id, ok := idParam(c, "id")
	if !ok {
		return
	}
	insp, err := h.svc.Confirm(c.Request.Context(), authctx.UserID(c), id)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, insp, nil)
}

func idParam(c *gin.Context, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(name))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_ID", "Invalid id", nil)
		return uuid.Nil, false
	}
	return id, true
}
