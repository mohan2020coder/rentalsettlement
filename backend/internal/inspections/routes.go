package inspections

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/billing"
	"rental-settlement/backend/internal/notifications"
	"rental-settlement/backend/internal/tenancies"
	"rental-settlement/backend/pkg/storage"
)

// RegisterRoutes wires the authenticated inspection routes.
func RegisterRoutes(group *gin.RouterGroup, db *gorm.DB, tenancySvc *tenancies.Service, billingSvc *billing.Service, auditSvc *audit.Service, notify *notifications.Service, storageService storage.Service) {
	repo := NewRepository(db)
	svc := NewService(repo, tenancySvc, billingSvc, auditSvc, notify, storageService)
	h := NewHandler(svc)

	g := group.Group("/inspections")
	g.GET("/tenancy/:tenancyID", h.List)
	g.POST("/tenancy/:tenancyID/move-in", h.CreateMoveIn)
	g.POST("/tenancy/:tenancyID/move-out", h.CreateMoveOut)
	g.GET("/:id", h.Get)
	g.PUT("/:id/rooms/:roomID/items/:itemID", h.SaveItem)
	g.POST("/:id/media", h.AddMedia)
	g.POST("/:id/confirm", h.Confirm)
}
