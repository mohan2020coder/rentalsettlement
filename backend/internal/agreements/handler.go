package agreements

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/response"
)

// Handler exposes agreement endpoints.
type Handler struct {
	svc *Service
}

// NewHandler builds the agreement handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// CreateVersion handles POST /api/v1/agreements/tenancy/:tenancyID/versions.
func (h *Handler) CreateVersion(c *gin.Context) {
	tenancyID, ok := parseID(c)
	if !ok {
		return
	}
	var req CreateVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	version, err := h.svc.CreateVersion(c.Request.Context(), authctx.UserID(c), tenancyID, req)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.Created(c, toDTO(version))
}

// Current handles GET /api/v1/agreements/tenancy/:tenancyID/current.
func (h *Handler) Current(c *gin.Context) {
	tenancyID, ok := parseID(c)
	if !ok {
		return
	}
	version, err := h.svc.Current(c.Request.Context(), authctx.UserID(c), tenancyID)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, toDTO(version), nil)
}

// ListVersions handles GET /api/v1/agreements/tenancy/:tenancyID/versions.
func (h *Handler) ListVersions(c *gin.Context) {
	tenancyID, ok := parseID(c)
	if !ok {
		return
	}
	list, err := h.svc.ListVersions(c.Request.Context(), authctx.UserID(c), tenancyID)
	if err != nil {
		response.Abort(c, err)
		return
	}
	out := make([]*AgreementVersionDTO, 0, len(list))
	for i := range list {
		out = append(out, toDTO(&list[i]))
	}
	response.OK(c, out, nil)
}

// Approve handles POST /api/v1/agreements/tenancy/:tenancyID/versions/:version/approve.
func (h *Handler) Approve(c *gin.Context) {
	tenancyID, ok := parseID(c)
	if !ok {
		return
	}
	version, ok := parseVersion(c.Param("version"))
	if !ok {
		response.Error(c, http.StatusBadRequest, "INVALID_VERSION", "Invalid version number", nil)
		return
	}
	v, err := h.svc.Approve(c.Request.Context(), authctx.UserID(c), tenancyID, version)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, toDTO(v), nil)
}

func parseID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_ID", "Invalid id", nil)
		return uuid.Nil, false
	}
	return id, true
}
