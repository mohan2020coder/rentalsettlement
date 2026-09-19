package middleware

import "context"

type ctxKey int

const (
	keyClientIP ctxKey = iota
	keyUserAgent
)

// WithClientMeta attaches request client metadata to the context so service
// layers can capture it for audit records without depending on gin.
func WithClientMeta(ctx context.Context, ip string, userAgent string) context.Context {
	ctx = context.WithValue(ctx, keyClientIP, ip)
	ctx = context.WithValue(ctx, keyUserAgent, userAgent)
	return ctx
}

// ClientMeta returns the ip and user agent captured for auditing.
func ClientMeta(ctx context.Context) (string, string) {
	ip, _ := ctx.Value(keyClientIP).(string)
	ua, _ := ctx.Value(keyUserAgent).(string)
	return ip, ua
}
