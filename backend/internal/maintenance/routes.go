package maintenance

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/billing"
	"rental-settlement/backend/internal/notifications"
	"rental-settlement/backend/internal/tenancies"
)

// RegisterRoutes wires the authenticated maintenance routes.
func RegisterRoutes(group *gin.RouterGroup, db *gorm.DB, tenancySvc *tenancies.Service, billingSvc *billing.Service, auditSvc *audit.Service, notify *notifications.Service) {
	repo := NewRepository(db)
	svc := NewService(repo, tenancySvc, billingSvc, auditSvc, notify)
	h := NewHandler(svc)

	g := group.Group("/maintenance")
	g.GET("/tenancy/:tenancyID", h.List)
	g.POST("/tenancy/:tenancyID", h.Report)
	g.GET("/:id", h.Get)
	g.GET("/:id/comments", h.GetComments)
	g.POST("/:id/comments", h.AddComment)
	g.POST("/:id/media", h.AddMedia)
	g.POST("/:id/status", h.UpdateStatus)
}
