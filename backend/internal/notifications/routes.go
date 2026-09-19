package notifications

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// RegisterRoutes wires the authenticated notification routes.
func RegisterRoutes(group *gin.RouterGroup, db *gorm.DB) {
	svc := NewService(db)
	h := NewHandler(svc)

	g := group.Group("/notifications")
	g.GET("", h.List)
	g.GET("/unread-count", h.UnreadCount)
	g.POST("/read-all", h.MarkAllRead)
	g.POST("/:id/read", h.MarkRead)
}
