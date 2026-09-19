package migrations

import "embed"

// FS embeds all *.sql migration files so the compiled binary ships with them.
//
//go:embed *.sql
var FS embed.FS

// FSName is the name used in the schema_migrations tracking table.
const FSName = "migrations"
