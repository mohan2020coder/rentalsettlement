package uploads

import (
	"io"
	"mime"
	"net/http"
	"path"
	"strings"

	"github.com/gin-gonic/gin"

	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/response"
	"rental-settlement/backend/pkg/storage"
)

// Handler exposes upload endpoints.
type Handler struct {
	svc *Service
}

// NewHandler builds the upload handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Upload handles POST /api/v1/storage/upload (multipart).
func (h *Handler) Upload(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_UPLOAD", "No file provided in multipart field 'file'", nil)
		return
	}
	defer file.Close()

	mimeType := strings.TrimSpace(header.Header.Get("Content-Type"))
	if mimeType == "" {
		mimeType = mime.TypeByExtension(path.Ext(header.Filename))
	}

	data, err := io.ReadAll(io.LimitReader(file, MaxUploadBytes+1))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "UPLOAD_READ_FAILED", "Could not read the uploaded file", nil)
		return
	}
	if int64(len(data)) > MaxUploadBytes {
		response.Error(c, http.StatusBadRequest, "INVALID_UPLOAD", "File exceeds the 8 MB upload limit", nil)
		return
	}

	result, err := h.svc.Upload(c.Request.Context(), authctx.UserID(c), data, mimeType)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.Created(c, result)
}

// Serve handles GET /api/v1/storage/*path. It is intentionally unauthenticated
// so images can be rendered directly by the mobile app; keys are unguessable
// server-generated UUIDs.
func (h *Handler) Serve(c *gin.Context) {
	key := strings.TrimPrefix(c.Param("filepath"), "/")
	if err := storage.ValidateKey(key); err != nil {
		response.Error(c, http.StatusNotFound, "NOT_FOUND", "Object not found", nil)
		return
	}

	rc, err := h.svc.storage.Open(c.Request.Context(), key)
	if err != nil {
		response.Error(c, http.StatusNotFound, "NOT_FOUND", "Object not found", nil)
		return
	}
	defer rc.Close()

	contentType := mime.TypeByExtension(path.Ext(key))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	reader, err := io.ReadAll(rc)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Could not read object", nil)
		return
	}

	c.Data(http.StatusOK, contentType, reader)
}