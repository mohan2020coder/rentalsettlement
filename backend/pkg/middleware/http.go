package middleware

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// CORS configures cross-origin access for the mobile client.
func CORS(allowedOrigins string) gin.HandlerFunc {
	origins := map[string]bool{}
	for _, o := range strings.Split(allowedOrigins, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			origins[o] = true
		}
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" {
			c.Next()
			return
		}
		allow := origins["*"]
		if !allow {
			allow = origins[origin]
		}
		if !allow {
			c.Next()
			return
		}
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Vary", "Origin")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID")
		c.Header("Access-Control-Expose-Headers", "X-Request-ID")
		c.Header("Access-Control-Allow-Credentials", "true")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// SecurityHeaders sets sane baseline security headers on every response.
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "no-referrer")
		c.Header("X-XSS-Protection", "0")
		c.Header("Cache-Control", "no-store")
		c.Next()
	}
}

// RequestLogger emits one structured log line per request.
func RequestLogger(log *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Request = c.Request.WithContext(WithClientMeta(c.Request.Context(), c.ClientIP(), c.Request.UserAgent()))
		c.Next()
		latency := time.Since(start)
		log.Info("http_request",
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"status", c.Writer.Status(),
			"latency_ms", latency.Milliseconds(),
			"bytes", c.Writer.Size(),
			"ip", c.ClientIP(),
			"user_agent", c.Request.UserAgent(),
			"request_id", RequestIDFromContext(c),
		)
	}
}

// Recovery logs panics and returns a JSON 500 instead of crashing the process.
func Recovery(log *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				log.Error("panic_recovered",
					"error", err,
					"request_id", RequestIDFromContext(c),
					"path", c.Request.URL.Path,
				)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error": gin.H{
						"code":    "INTERNAL_ERROR",
						"message": "Something went wrong",
					},
				})
			}
		}()
		c.Next()
	}
}
