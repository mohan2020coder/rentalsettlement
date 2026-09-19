package audit

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// TenancyGuard authorizes a tenancy-scoped request. It must be injected by the
// server wiring to avoid an import cycle (audit cannot import tenancies).
type TenancyGuard gin.HandlerFunc

// RegisterRoutes wires the authenticated audit routes. The guard rejects
// requests from users who are not parties of the requested tenancy.
func RegisterRoutes(group *gin.RouterGroup, db *gorm.DB, guard gin.HandlerFunc) {
	svc := NewService(db)
	h := NewHandler(svc)

	g := group.Group("/audit")
	g.GET("/me", h.MyLog)
	g.GET("/tenancy/:tenancyID", guard, h.TenancyLog)
}
