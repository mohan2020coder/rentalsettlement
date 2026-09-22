package uploads

import (
	"github.com/gin-gonic/gin"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/billing"
	"rental-settlement/backend/pkg/storage"
)

// RegisterRoutes wires the upload (authenticated) and serve (public) routes.
func RegisterRoutes(api *gin.RouterGroup, protected *gin.RouterGroup, st storage.Service, billingSvc *billing.Service, entitlements *billing.EntitlementService, auditSvc *audit.Service) {
	h := NewHandler(NewService(st, billingSvc, entitlements, auditSvc))

	files := protected.Group("/storage")
	files.POST("/upload", h.Upload)

	// Serve is public so <Image source={{ uri }}> can render photos directly.
	api.GET("/storage/*filepath", h.Serve)
}