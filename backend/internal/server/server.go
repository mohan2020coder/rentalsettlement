package server

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"rental-settlement/backend/internal/agreements"
	"rental-settlement/backend/internal/applications"
	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/auth"
	"rental-settlement/backend/internal/billing"
	"rental-settlement/backend/internal/config"
	"rental-settlement/backend/internal/deductions"
	"rental-settlement/backend/internal/evidence"
	"rental-settlement/backend/internal/inspections"
	"rental-settlement/backend/internal/maintenance"
	"rental-settlement/backend/internal/notifications"
	"rental-settlement/backend/internal/properties"
	"rental-settlement/backend/internal/settlements"
	"rental-settlement/backend/internal/tenancies"
	"rental-settlement/backend/internal/users"
	"rental-settlement/backend/pkg/middleware"
	"rental-settlement/backend/pkg/storage"
)

// Deps carries shared dependencies to all route registrars.
type Deps struct {
	DB      *gorm.DB
	Cfg     *config.Config
	Log     *slog.Logger
	Storage storage.Service
}

// Components bundles the constructed services so handlers can be composed.
type Components struct {
	Users          *users.Service
	UserRepo       *users.Repository
	Auth           *auth.Service
	AuthMW         gin.HandlerFunc
	Audit          *audit.Service
	Notifications  *notifications.Service
	Billing        *billing.Service
	BillingRepo    *billing.Repository
	Entitlements   *billing.EntitlementService
	Properties     *properties.Service
	Tenancies      *tenancies.Service
	TenancyRepo    *tenancies.Repository
	Inspections    *inspections.Service
	Agreements     *agreements.Service
	Maintenance    *maintenance.Service
	Deductions     *deductions.Service
	DeductionsRepo *deductions.Repository
	Settlements    *settlements.Service
	JWT            *auth.Manager
	Deps           Deps
}

// App assembles the HTTP server from modules.
type App struct {
	Engine     *gin.Engine
	Deps       Deps
	Components Components
}

// New builds the gin engine with global middleware and module routes registered.
func New(deps Deps) *App {
	gin.SetMode(gin.ReleaseMode)
	if deps.Cfg.AppEnv == "development" {
		gin.SetMode(gin.DebugMode)
	}

	engine := gin.New()
	engine.Use(
		middleware.RequestID(),
		middleware.SecurityHeaders(),
		middleware.CORS(deps.Cfg.CORSAllowedOrigins),
		middleware.Recovery(deps.Log),
		middleware.RequestLogger(deps.Log),
	)

	app := &App{Engine: engine, Deps: deps}
	app.buildComponents()
	app.registerRoutes()
	return app
}

func (a *App) buildComponents() {
	cfg := a.Deps.Cfg

	a.Components.UserRepo = users.NewRepository(a.Deps.DB)
	a.Components.Users = users.NewService(a.Components.UserRepo)
	a.Components.Audit = audit.NewService(a.Deps.DB)
	a.Components.Notifications = notifications.NewService(a.Deps.DB)
	a.Components.BillingRepo = billing.NewRepository(a.Deps.DB)
	a.Components.Billing = billing.NewService(a.Components.BillingRepo)
	a.Components.Entitlements = billing.NewEntitlementService(a.Components.BillingRepo)

	a.Components.JWT = auth.NewManager(
		cfg.JWT.AccessSecret,
		cfg.JWT.RefreshSecret,
		cfg.JWT.AccessTTL,
		cfg.JWT.RefreshTTL,
	)
	tokenRepo := auth.NewTokenRepository(a.Deps.DB)
	a.Components.Auth = auth.NewService(
		a.Components.UserRepo,
		tokenRepo,
		a.Components.Billing,
		a.Components.Audit,
		a.Components.JWT,
	)
	a.Components.AuthMW = auth.Middleware(a.Components.JWT, a.Components.UserRepo)

	propRepo := properties.NewRepository(a.Deps.DB)
	a.Components.Properties = properties.NewService(propRepo, a.Components.UserRepo, a.Components.Billing, a.Components.Entitlements, a.Components.Audit)
	a.Components.TenancyRepo = tenancies.NewRepository(a.Deps.DB)
	a.Components.Tenancies = tenancies.NewService(a.Components.TenancyRepo, propRepo, a.Components.UserRepo, a.Components.Billing, a.Components.Entitlements, a.Components.Audit, a.Components.Notifications)
	a.Components.Inspections = inspections.NewService(inspections.NewRepository(a.Deps.DB), a.Components.Tenancies, a.Components.Billing, a.Components.Audit, a.Components.Notifications, a.Deps.Storage)
	a.Components.Agreements = agreements.NewService(agreements.NewRepository(a.Deps.DB), a.Components.Tenancies, a.Components.Audit, a.Components.Notifications)
	a.Components.Maintenance = maintenance.NewService(maintenance.NewRepository(a.Deps.DB), a.Components.Tenancies, a.Components.Billing, a.Components.Audit, a.Components.Notifications)
	a.Components.DeductionsRepo = deductions.NewRepository(a.Deps.DB)
	a.Components.Deductions = deductions.NewService(a.Components.DeductionsRepo, a.Components.Tenancies, a.Components.Audit, a.Components.Notifications)
	a.Components.Settlements = settlements.NewService(settlements.NewRepository(a.Deps.DB), propRepo, a.Components.Tenancies, a.Components.DeductionsRepo, a.Components.Audit, a.Components.Notifications)
}

func (a *App) registerRoutes() {
	a.Engine.GET("/healthz", a.health)
	a.Engine.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "rental-settlement-api",
			"version": "v1",
		})
	})

	api := a.Engine.Group("/api/v1")

	// Public auth routes.
	auth.Register(api, a.Components.Auth)

	// Authenticated routes.
	protected := api.Group("", a.Components.AuthMW)
	users.RegisterRoutes(protected, a.Components.Users)
	billing.RegisterRoutes(protected, a.Deps.DB)
	properties.RegisterRoutes(protected, a.Deps.DB, a.Components.UserRepo, a.Components.Billing, a.Components.Entitlements, a.Components.Audit)
	tenancies.RegisterRoutes(protected, a.Deps.DB, properties.NewRepository(a.Deps.DB), a.Components.UserRepo, a.Components.Billing, a.Components.Entitlements, a.Components.Audit, a.Components.Notifications)
	agreements.RegisterRoutes(protected, a.Deps.DB, a.Components.Tenancies, a.Components.Audit, a.Components.Notifications)
	inspections.RegisterRoutes(protected, a.Deps.DB, a.Components.Tenancies, a.Components.Billing, a.Components.Audit, a.Components.Notifications, a.Deps.Storage)
	maintenance.RegisterRoutes(protected, a.Deps.DB, a.Components.Tenancies, a.Components.Billing, a.Components.Audit, a.Components.Notifications)
	deductions.RegisterRoutes(protected, a.Deps.DB, a.Components.Tenancies, a.Components.Audit, a.Components.Notifications)
	settlements.RegisterRoutes(protected, a.Deps.DB, properties.NewRepository(a.Deps.DB), a.Components.Tenancies, a.Components.DeductionsRepo, a.Components.Audit, a.Components.Notifications)
	applications.RegisterRoutes(protected, a.Deps.DB, properties.NewRepository(a.Deps.DB), a.Components.UserRepo, a.Components.Tenancies, a.Components.Agreements, a.Components.Audit, a.Components.Notifications)
	audit.RegisterRoutes(protected, a.Deps.DB, tenancies.GuardParty(a.Components.Tenancies))
	notifications.RegisterRoutes(protected, a.Deps.DB)
	evidence.RegisterRoutes(protected, a.Deps.DB, a.Components.Tenancies, a.Components.Audit)
}

func (a *App) health(c *gin.Context) {
	sqlDB, err := a.Deps.DB.DB()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "degraded", "error": "database unavailable"})
		return
	}
	if err := sqlDB.Ping(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "degraded", "error": "database unreachable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status":   "ok",
		"time":     time.Now().UTC().Format(time.RFC3339),
		"database": "up",
	})
}
