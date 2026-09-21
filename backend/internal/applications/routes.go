package applications

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"rental-settlement/backend/internal/agreements"
	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/notifications"
	"rental-settlement/backend/internal/properties"
	"rental-settlement/backend/internal/tenancies"
	"rental-settlement/backend/internal/users"
)

// RegisterRoutes wires the authenticated application routes.
func RegisterRoutes(group *gin.RouterGroup, db *gorm.DB, propRepo *properties.Repository, userRepo *users.Repository, tenancySvc *tenancies.Service, agreementSvc *agreements.Service, auditSvc *audit.Service, notify *notifications.Service) {
	repo := NewRepository(db)
	svc := NewService(repo, propRepo, userRepo, tenancySvc, agreementSvc, auditSvc, notify)
	h := NewHandler(svc)

	g := group.Group("/applications")
	g.POST("", h.Create)
	g.GET("", h.List)
	g.POST("/:id/cancel", h.Cancel)
	g.POST("/:id/approve", h.Approve)
	g.POST("/:id/reject", h.Reject)
}
