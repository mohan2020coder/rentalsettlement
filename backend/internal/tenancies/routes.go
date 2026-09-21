package tenancies

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/billing"
	"rental-settlement/backend/internal/notifications"
	"rental-settlement/backend/internal/properties"
	"rental-settlement/backend/internal/users"
	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/response"
)

// RegisterRoutes wires the authenticated tenancy routes.
func RegisterRoutes(group *gin.RouterGroup, db *gorm.DB, propRepo *properties.Repository, userRepo *users.Repository, billingSvc *billing.Service, entitlements *billing.EntitlementService, auditSvc *audit.Service, notify *notifications.Service) {
	repo := NewRepository(db)
	svc := NewService(repo, propRepo, userRepo, billingSvc, entitlements, auditSvc, notify)
	h := NewHandler(svc)

	g := group.Group("/tenancies")
	g.POST("", h.Create)
	g.GET("", h.List)
	g.GET("/:id", h.Get)
	g.POST("/:id/accept", h.Accept)
	g.POST("/:id/status", h.UpdateStatus)
}

// GuardParty is middleware that lets only the tenancy parties through. It is
// used by scoped modules (audit) that cannot import tenancies without a cycle.
func GuardParty(svc *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("tenancyID"))
		if err != nil {
			response.Error(c, 400, "INVALID_ID", "Invalid id", nil)
			c.Abort()
			return
		}
		if _, err := svc.CheckAccess(c.Request.Context(), authctx.UserID(c), id); err != nil {
			response.Abort(c, err)
			c.Abort()
			return
		}
		c.Next()
	}
}
