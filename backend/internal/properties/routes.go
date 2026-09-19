package properties

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/billing"
	"rental-settlement/backend/internal/users"
)

// RegisterRoutes wires the authenticated property routes.
func RegisterRoutes(group *gin.RouterGroup, db *gorm.DB, userRepo *users.Repository, billingSvc *billing.Service, entitlements *billing.EntitlementService, auditSvc *audit.Service) {
	repo := NewRepository(db)
	svc := NewService(repo, userRepo, billingSvc, entitlements, auditSvc)
	h := NewHandler(svc)

	g := group.Group("/properties")
	g.POST("", h.Create)
	g.GET("", h.List)
	g.GET("/:id", h.Get)
	g.PATCH("/:id", h.Update)
}
