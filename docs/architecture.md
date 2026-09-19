# Architecture

Rental Settlement is a **documentation and negotiation platform** for rental
deposits. Its job is to help landlord and tenant agree on and record the
outcome of a tenancy — the deposit stays with whoever held it; the platform
**never moves money**. Every step is recorded in an append-only audit log, and
a downloadable PDF dossier lets both parties keep a single agreed record.

## Layout

```
rental-settlement/
├── backend/            Go service (Gin + GORM + PostgreSQL)
│   ├── cmd/server/     main entry point (config, migrate, seed, serve)
│   ├── internal/       business modules
│   ├── migrations/     incremental SQL 0001..0008
│   ├── pkg/            shared plumbing (response, authctx, storage, ...)
│   ├── seeds/          plan catalog + demo tenancy (Rajesh & Arun)
│   └── tests/          integration tests against a real PostgreSQL
├── mobile/             React Native app (source layout only so far)
├── docs/               this documentation
└── .gitignore
```

## Modules (`internal/`)

| Module | Responsibility |
|---|---|
| `config`, `database`, `logger` | Bootstrap: env config, connection + migration runner |
| `users`, `auth` | Accounts, Argon2id + JWT (access/refresh) sessions |
| `billing` | Plan catalog, subscriptions, usage meters, entitlement checks |
| `properties` | Property registry owned by a landlord |
| `tenancies` | Invite/accept lifecycle, status machine, usage counting |
| `agreements` | Versioned, dual-confirmed rental terms |
| `inspections` | Move-in / move-out condition capture with photos and confirmations |
| `maintenance` | Issue tracking per tenancy |
| `deductions` | Landlord claims + structured dispute negotiation |
| `settlements` | Final statement computed from agreed deductions, dual confirmation |
| `evidence` | PDF dossier bundling everything about a tenancy |
| `audit` | Append-only audit log, per-user and per-tenancy views |
| `notifications` | In-platform notification inbox |

Every module following the same pattern: `model.go` (GORM structs),
`repository.go` (queries), `service.go` (business rules), `dto.go`,
`handler.go` (HTTP), `routes.go` (gin wiring). Modules depend on shared
`pkg/` code, never on `internal/server`. `internal/server/server.go` is the
only composition root and wiring hub.

## Rules that cross modules

- **IDs** are UUIDs. GORM models use `gen_random_uuid()` defaults.
- **Money** is an integer number of minor units (`*_minor` columns) plus an ISO
  currency code. `pkg/money` renders display strings. No float money anywhere.
- **Access** is enforced per tenancy by `tenancies.CheckAccess` (landlord or
  assigned tenant only). Strangers get `403 FORBIDDEN`.
- **Audit** every significant state change writes an immutable
  `audit_logs` row (`audit.Default? no — `audit.Record`).
- **Side effects** (notifications, audit, usage meters) are best-effort and
  never block the primary write.

## Data flow

```
Client ──HTTP──> gin handlers ──> service (rules) ──> repository ──> PostgreSQL
                        │              │
                        └── audit ─────┘        usage meters ──> billing limits
                        └── notifications ─────> inbox
                        └── evidence ──────────> PDF dossier (tenancy parties)
```

## Tenancy-scoped routes

Audit and evidence are scoped to a tenancy but live in packages that must not
import `tenancies` (cycle). `tenancies.GuardParty` — injected by the server
wiring — performs the party check before the handler runs.