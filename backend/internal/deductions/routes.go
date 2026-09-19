package deductions

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/notifications"
	"rental-settlement/backend/internal/tenancies"
)

// RegisterRoutes wires the authenticated deduction + dispute routes.
func RegisterRoutes(group *gin.RouterGroup, db *gorm.DB, tenancySvc *tenancies.Service, auditSvc *audit.Service, notify *notifications.Service) {
	repo := NewRepository(db)
	svc := NewService(repo, tenancySvc, auditSvc, notify)
	h := NewHandler(svc)

	d := group.Group("/deductions")
	d.GET("/tenancy/:tenancyID", h.List)
	d.POST("/tenancy/:tenancyID", h.Propose)
	d.GET("/:id", h.Get)
	d.POST("/:id/accept", h.Accept)
	d.POST("/:id/dispute", h.Dispute)
	d.POST("/:id/withdraw", h.Withdraw)

	dis := group.Group("/disputes")
	dis.GET("/tenancy/:tenancyID", h.DisputeList)
	dis.GET("/:id", h.DisputeGet)
	dis.POST("/:id/accept", h.DisputeAccept)
	dis.POST("/:id/counter-offer", h.CounterOffer)
	dis.POST("/:id/withdraw", h.DisputeWithdraw)
}
