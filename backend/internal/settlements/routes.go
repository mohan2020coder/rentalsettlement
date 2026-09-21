package settlements

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/deductions"
	"rental-settlement/backend/internal/notifications"
	"rental-settlement/backend/internal/properties"
	"rental-settlement/backend/internal/tenancies"
)

// RegisterRoutes wires the authenticated settlement routes.
func RegisterRoutes(group *gin.RouterGroup, db *gorm.DB, propRepo *properties.Repository, tenancySvc *tenancies.Service, deductRepo *deductions.Repository, auditSvc *audit.Service, notify *notifications.Service) {
	repo := NewRepository(db)
	svc := NewService(repo, propRepo, tenancySvc, deductRepo, auditSvc, notify)
	h := NewHandler(svc)

	g := group.Group("/settlements")
	g.GET("/tenancy/:tenancyID", h.Get)
	g.POST("/tenancy/:tenancyID", h.Generate)
	g.POST("/tenancy/:tenancyID/regenerate", h.Regenerate)
	g.POST("/tenancy/:tenancyID/confirm", h.Confirm)
}
