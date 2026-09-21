# Rental Settlement

A **documentation and negotiation platform** for rental deposits. It helps
landlords and tenants agree on — and permanently record — the outcome of a
tenancy: inspections, maintenance, deduction claims, disputes, and a final
settlement statement. The platform **never moves money**; it produces the
agreed record so the refund can happen off-platform with both parties aligned.

## What it does

- Invite/accept tenancy lifecycle with a state machine
- Versioned rental agreements confirmed by both parties
- Move-in / move-out inspections with room-level condition capture and photos
- Maintenance request tracking
- Landlord deduction claims and structured dispute negotiation
- A final itemized **settlement** computed from agreed deductions
- A one-click **PDF evidence dossier** bundling every record of the tenancy
- Full append-only **audit trail** and in-platform notifications
- Tiered **billing** with usage meters (no real payments in the MVP)

## Stack

| Layer | Technology |
|---|---|
| API | Go 1.25, Gin, GORM |
| Database | PostgreSQL 14 (SQL migrations) |
| Auth | Argon2id + JWT access/refresh |
| Mobile | React Native (in progress) |
| Docs | `docs/` |
| Ops | Docker Compose |

## Quick start (local)

```bash
# 1. create the databases
psql -U postgres -c "CREATE DATABASE rental_settlement; CREATE DATABASE rental_settlement_test;"

# 2. configure and run
cd backend
cp .env.example .env        # set secrets + DATABASE_URL
go run ./cmd/server
```

Migrations run automatically at startup. Demo accounts are seeded
idempotently:

| Role | Email | Password |
|---|---|---|
| Landlord | `rajesh@example.in` | `Demo@1234` |
| Tenant | `arun@example.in` | `Demo@1234` |

## Quick start (Docker)

```bash
docker compose up --build
curl http://localhost:8080/healthz
```

## Tests

```bash
cd backend
go test ./... -count=1
```

## Documentation

- [`docs/getting-started.md`](docs/getting-started.md) — setup, configuration, demo accounts
- [`docs/architecture.md`](docs/architecture.md) — module layout and design rules
- [`docs/domain.md`](docs/domain.md) — state machines and business rules
- [`docs/api.md`](docs/api.md) — full endpoint reference
- [`docs/billing.md`](docs/billing.md) — plans, limits, usage metering

## Repository layout

```
backend/      Go API service
mobile/       React Native app (source layout scaffolded)
docs/         documentation
migrations/   (inside backend) incremental SQL
```
