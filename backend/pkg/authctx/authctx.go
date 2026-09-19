// Package authctx exposes the authenticated-user context helpers used by
// handlers across modules. It stays dependency-free so every module can read
// the current user without importing the auth module (avoiding import cycles).
package authctx

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	keyUserID = "auth_user_id"
	keyRole   = "auth_role"
)

// SetUserID stores the authenticated user id in the gin context.
func SetUserID(c *gin.Context, id uuid.UUID) { c.Set(keyUserID, id) }

// SetRole stores the authenticated user's role in the gin context.
func SetRole(c *gin.Context, role string) { c.Set(keyRole, role) }

// UserID returns the authenticated user id, or uuid.Nil when absent.
func UserID(c *gin.Context) uuid.UUID {
	v, ok := c.Get(keyUserID)
	if !ok {
		return uuid.Nil
	}
	id, _ := v.(uuid.UUID)
	return id
}

// Role returns the authenticated user's role, or "" when absent.
func Role(c *gin.Context) string {
	v, ok := c.Get(keyRole)
	if !ok {
		return ""
	}
	role, _ := v.(string)
	return role
}
