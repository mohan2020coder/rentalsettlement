package logger

import (
	"context"
	"log/slog"
	"os"
)

// Level maps a string level name to slog.Level.
func buildLevel(name string) slog.Level {
	switch name {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// New creates a structured JSON logger writing to stdout.
func New(levelName string) *slog.Logger {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: buildLevel(levelName),
	})
	return slog.New(handler)
}

// Ctx is a small helper to log with a request context attached.
func Ctx(ctx context.Context, l *slog.Logger) *slog.Logger {
	return l.With("request_id", requestID(ctx))
}

type requestIDKey struct{}

// WithRequestID stores a request id in the context.
func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDKey{}, id)
}

func requestID(ctx context.Context) any {
	if id, ok := ctx.Value(requestIDKey{}).(string); ok {
		return id
	}
	return ""
}
