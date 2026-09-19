package auth

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rental-settlement/backend/internal/users"
	"rental-settlement/backend/pkg/middleware"
)

// Register wires the public auth routes (no JWT required).
func Register(group *gin.RouterGroup, svc *Service) {
	h := NewHandler(svc)

	routes := group.Group("/auth")
	routes.POST("/register", h.Register)
	routes.POST("/login", middleware.RateLimit(2, 4), h.Login)
	routes.POST("/refresh", h.Refresh)
	routes.POST("/logout", Middleware(svc.jwt, svc.users), h.Logout)
}

// Middleware builds the JWT access guard bound to the user repository.
func Middleware(mgr *Manager, userRepo *users.Repository) gin.HandlerFunc {
	loadUser := func(ctx context.Context, id uuid.UUID) (role, status string, err error) {
		u, e := userRepo.ByID(ctx, id)
		if e != nil {
			return "", "", e
		}
		return u.Role, u.Status, nil
	}
	return RequireAuth(mgr, loadUser)
}
