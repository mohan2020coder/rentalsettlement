package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"rental-settlement/backend/internal/config"
	"rental-settlement/backend/internal/database"
	"rental-settlement/backend/internal/server"
	"rental-settlement/backend/pkg/logger"
	"rental-settlement/backend/pkg/storage"
	"rental-settlement/backend/seeds"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fatal("config: " + err.Error())
	}
	if errs := cfg.Validate(); len(errs) > 0 {
		fatal("config validation failed: " + errs[0].Error())
	}

	log := logger.New(cfg.LogLevel)

	db, err := database.Open(cfg.DatabaseURL, cfg.AppEnv, log)
	if err != nil {
		fatal("database connection: " + err.Error())
	}

	if err := database.Migrate(db, log); err != nil {
		fatal("migration failed: " + err.Error())
	}
	log.Info("migrations applied")

	if err := seeds.SeedPlans(context.Background(), db); err != nil {
		fatal("plan seeding failed: " + err.Error())
	}
	log.Info("plans seeded")

	if err := seeds.SeedDemo(context.Background(), db); err != nil {
		fatal("demo seeding failed: " + err.Error())
	} else {
		log.Info("demo data ready", "email", seeds.DemoLandlordEmail, "password", seeds.DemoPassword)
	}

	st, err := storage.NewLocal(cfg.Storage.Root)
	if err != nil {
		fatal("storage: " + err.Error())
	}

	app := server.New(server.Deps{
		DB:      db,
		Cfg:     cfg,
		Log:     log,
		Storage: st,
	})

	srv := &http.Server{
		Addr:         cfg.HTTPAddr,
		Handler:      app.Engine,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
	}

	go func() {
		log.Info("server listening", "addr", cfg.HTTPAddr, "env", cfg.AppEnv)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			fatal("server: " + err.Error())
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	log.Info("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

func fatal(msg string) {
	logger.New("error").Error("fatal", "message", msg)
	os.Exit(1)
}
