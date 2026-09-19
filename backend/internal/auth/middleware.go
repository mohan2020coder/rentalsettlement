package auth

import (
	"context"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/response"
)

// RequireAuth is the JWT access-token guard. It also loads the user so disabled
// accounts are rejected.
func RequireAuth(mgr *Manager, loadUser func(context.Context, uuid.UUID) (string, string, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			response.Error(c, 401, "UNAUTHORIZED", "Missing authorization header", nil)
			return
		}
		token, ok := strings.CutPrefix(header, "Bearer ")
		if !ok {
			response.Error(c, 401, "UNAUTHORIZED", "Bearer token required", nil)
			return
		}
		claims, err := mgr.ParseAccess(token)
		if err != nil {
			response.Error(c, 401, "UNAUTHORIZED", "Invalid or expired token", nil)
			return
		}

		role, status, err := loadUser(c.Request.Context(), claims.UserID)
		if err != nil {
			response.Error(c, 401, "UNAUTHORIZED", "User no longer exists", nil)
			return
		}
		if status != "ACTIVE" {
			response.Error(c, 403, "USER_DISABLED", "This account has been disabled", nil)
			return
		}

		authctx.SetUserID(c, claims.UserID)
		authctx.SetRole(c, role)
		c.Next()
	}
}

// RequireRole restricts access to specific roles.
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		current := authctx.Role(c)
		for _, r := range roles {
			if r == current {
				c.Next()
				return
			}
		}
		response.Error(c, 403, "FORBIDDEN", "You do not have permission to perform this action", nil)
	}
}
