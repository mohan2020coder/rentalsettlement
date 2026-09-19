package config

import (
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration loaded from environment variables.
type Config struct {
	AppEnv   string
	HTTPAddr string

	DatabaseURL string

	JWT struct {
		AccessSecret  string
		RefreshSecret string
		AccessTTL     time.Duration
		RefreshTTL    time.Duration
	}

	Storage struct {
		Root           string
		UploadMaxBytes int64
	}

	CORSAllowedOrigins string

	AuthRateLimitRPS float64

	LogLevel string
}

// Load reads configuration from the environment. In development it also
// attempts to load a `.env` file from the working directory if present.
func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{}
	cfg.AppEnv = getEnv("APP_ENV", "development")
	cfg.HTTPAddr = getEnv("HTTP_ADDR", ":8080")
	cfg.DatabaseURL = getEnv("DATABASE_URL", "")

	cfg.JWT.AccessSecret = getEnv("JWT_ACCESS_SECRET", "")
	cfg.JWT.RefreshSecret = getEnv("JWT_REFRESH_SECRET", "")
	accessTTL, err := time.ParseDuration(getEnv("ACCESS_TOKEN_TTL", "15m"))
	if err != nil {
		return nil, err
	}
	refreshTTL, err := time.ParseDuration(getEnv("REFRESH_TOKEN_TTL", "720h"))
	if err != nil {
		return nil, err
	}
	cfg.JWT.AccessTTL = accessTTL
	cfg.JWT.RefreshTTL = refreshTTL

	cfg.Storage.Root = getEnv("STORAGE_ROOT", "./storage")
	maxBytes, _ := strconv.ParseInt(getEnv("UPLOAD_MAX_BYTES", "15728640"), 10, 64)
	cfg.Storage.UploadMaxBytes = maxBytes

	cfg.CORSAllowedOrigins = getEnv("CORS_ALLOWED_ORIGINS", "*")

	rps, _ := strconv.ParseFloat(getEnv("AUTH_RATE_LIMIT_RPS", "10"), 64)
	cfg.AuthRateLimitRPS = rps

	cfg.LogLevel = getEnv("LOG_LEVEL", "info")

	if cfg.DatabaseURL == "" {
		return nil, ErrMissingDatabaseURL
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}
