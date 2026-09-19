// Package tests provides integration test helpers that exercise the assembled
// HTTP application against a real PostgreSQL database.
package tests

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"rental-settlement/backend/internal/config"
	"rental-settlement/backend/internal/database"
	"rental-settlement/backend/internal/server"
	storagelocal "rental-settlement/backend/pkg/storage"
	"rental-settlement/backend/seeds"
)

const defaultTestDSN = "postgres://postgres:postgres@localhost:5432/rental_settlement_test?sslmode=disable"

// TestConfig returns a fixed configuration for tests.
func TestConfig() *config.Config {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = defaultTestDSN
	}
	cfg, err := config.Load()
	if err != nil && cfg == nil {
		cfg = &config.Config{}
	}
	cfg.DatabaseURL = dsn
	cfg.AppEnv = "test"
	cfg.JWT.AccessSecret = "test-access-secret-32-chars-long!!"
	cfg.JWT.RefreshSecret = "test-refresh-secret-32-chars-long!!"
	cfg.JWT.AccessTTL = 15 * time.Minute
	cfg.JWT.RefreshTTL = 24 * time.Hour
	cfg.AuthRateLimitRPS = 100
	return cfg
}

// EnsureDatabase creates the test database when missing.
func EnsureDatabase(t *testing.T) {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = defaultTestDSN
	}
	adminDSN := strings.Replace(dsn, "/rental_settlement_test", "/postgres", 1)
	admin, err := database.Open(adminDSN, "test", slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatalf("connect admin db: %v", err)
	}
	adminSQL, _ := admin.DB()
	defer adminSQL.Close()

	var exists int
	admin.Raw("SELECT 1 FROM pg_database WHERE datname = 'rental_settlement_test'").Scan(&exists)
	if exists == 0 {
		if err := admin.Exec("CREATE DATABASE rental_settlement_test").Error; err != nil {
			t.Fatalf("create test db: %v", err)
		}
	}
}

// NewTestApp migrates + seeds a clean test database and returns the app,
// database handle and a close function.
func NewTestApp(t *testing.T) (*server.App, *gorm.DB, func()) {
	t.Helper()
	EnsureDatabase(t)
	cfg := TestConfig()

	quiet := slog.New(slog.NewTextHandler(io.Discard, nil))
	db, err := database.Open(cfg.DatabaseURL, cfg.AppEnv, quiet)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := database.Migrate(db, quiet); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	ResetTables(t, db)
	if err := seeds.SeedPlans(context.Background(), db); err != nil {
		t.Fatalf("seed plans: %v", err)
	}

	storageDir, _ := os.MkdirTemp("", "rental-settlement-test-storage")
	st, err := storagelocal.NewLocal(storageDir)
	if err != nil {
		t.Fatalf("storage: %v", err)
	}

	app := server.New(server.Deps{DB: db, Cfg: cfg, Log: quiet, Storage: st})
	cleanup := func() {
		_ = os.RemoveAll(storageDir)
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}
	return app, db, cleanup
}

// ResetTables truncates all application tables, leaving schema_migrations.
func ResetTables(t *testing.T, db *gorm.DB) {
	t.Helper()
	var tables []string
	db.Raw(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`).Scan(&tables)
	if len(tables) > 0 {
		stmt := "TRUNCATE TABLE " + strings.Join(tables, ", ") + " RESTART IDENTITY CASCADE"
		if err := db.Exec(stmt).Error; err != nil {
			t.Fatalf("truncate: %v", err)
		}
	}
}

// Perform executes a request against the app and returns the recorder.
func Perform(app *server.App, method, path string, body any, token string) *httptest.ResponseRecorder {
	payload := ""
	if body != nil {
		switch v := body.(type) {
		case string:
			payload = v
		default:
			b, _ := jsonMarshal(v)
			payload = string(b)
		}
	}
	req := httptest.NewRequest(method, path, strings.NewReader(payload))
	if payload != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	req.Header.Set("X-Request-ID", uuid.NewString())
	resp := httptest.NewRecorder()
	app.Engine.ServeHTTP(resp, req)
	return resp
}

// RegisterAndLogin creates a user through the API and returns the access token.
func RegisterAndLogin(t *testing.T, app *server.App, name, email, password, role string) (access, refresh string, userID uuid.UUID) {
	t.Helper()
	if password == "" {
		password = "password123"
	}
	body := fmt.Sprintf(`{"name":%q,"email":%q,"password":%q,"role":%q}`, name, email, password, role)
	resp := Perform(app, http.MethodPost, "/api/v1/auth/register", body, "")
	if resp.Code != http.StatusCreated {
		t.Fatalf("register failed: %d %s", resp.Code, resp.Body.String())
	}
	var out registerResponse
	decode(resp, &out)
	access = out.Data.AccessToken
	refresh = out.Data.RefreshToken
	userID = out.Data.User.ID
	return access, refresh, userID
}

// AuthHeader returns an Authorization header value.
func AuthHeader(token string) string { return "Bearer " + token }

// uniqueEmail returns a stable unique email per process.
func uniqueEmail(prefix string) string {
	return fmt.Sprintf("%s-%s@example.com", prefix, strings.ReplaceAll(os.Getenv("RENTBOOK_TEST_RUN"), "", uuid.NewString()[:8]))
}

type nilLogger struct{}

func (nilLogger) Printf(string, ...any) {}

// Ensure gin test mode.
func init() {
	gin.SetMode(gin.TestMode)
	_ = http.StatusOK // keep net/http imported
}
