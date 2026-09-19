package database

import (
	"log/slog"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

// Open connects to PostgreSQL using GORM and applies sensible pool settings.
func Open(databaseURL string, appEnv string, _ *slog.Logger) (*gorm.DB, error) {
	gormLogger := gormlogger.Default.LogMode(gormlogger.Warn)
	if appEnv == "development" {
		gormLogger = gormlogger.Default.LogMode(gormlogger.Info)
	}

	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		Logger: gormLogger,
		NamingStrategy: schema.NamingStrategy{
			SingularTable: false,
		},
		SkipDefaultTransaction: true,
	})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(time.Hour)

	return db, nil
}
