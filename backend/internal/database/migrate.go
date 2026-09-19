package database

import (
	"fmt"
	"io/fs"
	"log/slog"
	"sort"
	"strings"

	"gorm.io/gorm"

	"rental-settlement/backend/migrations"
)

// Migrate applies all pending SQL migrations inside a transaction each, in
// filename order, and tracks applied ones in schema_migrations.
func Migrate(db *gorm.DB, log *slog.Logger) error {
	if err := ensureMigrationTable(db); err != nil {
		return err
	}

	files, err := fs.Glob(migrations.FS, "*.sql")
	if err != nil {
		return err
	}
	sort.Strings(files)

	applied := appliedSet(db)

	for _, file := range files {
		if applied[file] {
			continue
		}
		sqlBytes, err := migrations.FS.ReadFile(file)
		if err != nil {
			return err
		}
		if err := applyMigration(db, file, string(sqlBytes)); err != nil {
			return fmt.Errorf("migration %s failed: %w", file, err)
		}
		log.Info("migration applied", "file", file)
	}
	return nil
}

func ensureMigrationTable(db *gorm.DB) error {
	return db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
	)`).Error
}

func appliedSet(db *gorm.DB) map[string]bool {
	set := map[string]bool{}
	var rows []struct {
		Version string
	}
	_ = db.Table("schema_migrations").Find(&rows).Error
	for _, r := range rows {
		set[r.Version] = true
	}
	return set
}

func applyMigration(db *gorm.DB, version string, sql string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		for _, stmt := range splitStatements(sql) {
			if strings.TrimSpace(stmt) == "" {
				continue
			}
			if err := tx.Exec(stmt).Error; err != nil {
				return err
			}
		}
		return tx.Exec(`INSERT INTO schema_migrations (version) VALUES (?)`, version).Error
	})
}

// splitStatements splits a migration file into individual SQL statements.
// Only simple `;` splitting is needed; stored procedures/functions would
// require a smarter splitter, which the migrations avoid.
func splitStatements(sql string) []string {
	var out []string
	current := strings.Builder{}
	for _, line := range strings.Split(sql, "\n") {
		current.WriteString(line)
		current.WriteString("\n")
		if strings.Contains(line, ";") {
			out = append(out, current.String())
			current.Reset()
		}
	}
	if current.String() != "" {
		out = append(out, current.String())
	}
	return out
}
