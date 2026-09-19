package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

type ipLimiter struct {
	mu      sync.Mutex
	clients map[string]*clientBucket
	rps     rate.Limit
	burst   int
	ttl     time.Duration
}

type clientBucket struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// RateLimit returns a middleware that limits each IP to rps requests per second
// with an optional burst. Stale buckets are evicted lazily.
func RateLimit(rps float64, burst int) gin.HandlerFunc {
	lim := &ipLimiter{
		clients: make(map[string]*clientBucket),
		rps:     rate.Limit(rps),
		burst:   burst,
		ttl:     time.Hour,
	}
	return func(c *gin.Context) {
		ip := c.ClientIP()
		bucket := lim.get(ip)
		if !bucket.limiter.Allow() {
			c.Header("Retry-After", "1")
			writeTooManyRequests(c)
			return
		}
		c.Next()
	}
}

func (l *ipLimiter) get(ip string) *clientBucket {
	l.mu.Lock()
	defer l.mu.Unlock()
	b, ok := l.clients[ip]
	if !ok {
		b = &clientBucket{limiter: rate.NewLimiter(l.rps, l.burst), lastSeen: time.Now()}
		l.clients[ip] = b
		return b
	}
	b.lastSeen = time.Now()
	return b
}

func writeTooManyRequests(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
		"success": false,
		"error": gin.H{
			"code":    "RATE_LIMITED",
			"message": "Too many requests, please try again shortly",
		},
	})
}
