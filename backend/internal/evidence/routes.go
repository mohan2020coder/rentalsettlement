package evidence

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/tenancies"
)

// RegisterRoutes wires the authenticated evidence routes.
func RegisterRoutes(group *gin.RouterGroup, db *gorm.DB, tenancySvc *tenancies.Service, auditSvc *audit.Service) {
	svc := NewService(db, tenancySvc, auditSvc)
	h := NewHandler(svc)

	g := group.Group("/evidence")
	g.GET("/tenancy/:tenancyID/download", h.Download)
}
