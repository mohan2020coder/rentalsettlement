package agreements

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/notifications"
	"rental-settlement/backend/internal/tenancies"
)

// RegisterRoutes wires the authenticated agreement routes.
func RegisterRoutes(group *gin.RouterGroup, db *gorm.DB, tenancySvc *tenancies.Service, auditSvc *audit.Service, notify *notifications.Service) {
	repo := NewRepository(db)
	svc := NewService(repo, tenancySvc, auditSvc, notify)
	h := NewHandler(svc)

	g := group.Group("/agreements")
	g.GET("/tenancy/:id/current", h.Current)
	g.GET("/tenancy/:id/versions", h.ListVersions)
	g.POST("/tenancy/:id/versions", h.CreateVersion)
	g.POST("/tenancy/:id/versions/:version/approve", h.Approve)
}
