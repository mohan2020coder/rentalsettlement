# Getting started

## Prerequisites

- Go 1.25+
- PostgreSQL 14+ running locally (`postgres` / `postgres` on `localhost:5432`)

## Database

```sql
CREATE DATABASE rental_settlement;
CREATE DATABASE rental_settlement_test;
```

## Run the API

```bash
cd backend
go run ./cmd/server
```

Configuration is read from environment variables (with `.env` support):

| Variable | Default | Notes |
|---|---|---|
| `APP_ENV` | `development` | enables gin debug in dev |
| `HTTP_ADDR` | `:8080` | listen address |
| `DATABASE_URL` | *(required)* | e.g. `postgres://postgres:postgres@localhost:5432/rental_settlement?sslmode=disable` |
| `JWT_ACCESS_SECRET` | *(required)* | access-token signing secret |
| `JWT_REFRESH_SECRET` | *(required)* | refresh-token signing secret |
| `ACCESS_TOKEN_TTL` | `15m` | |
| `REFRESH_TOKEN_TTL` | `720h` | |
| `STORAGE_ROOT` | `./storage` | media upload root |
| `UPLOAD_MAX_BYTES` | `15728640` | 15 MB per upload |
| `CORS_ALLOWED_ORIGINS` | `*` | |
| `AUTH_RATE_LIMIT_RPS` | `10` | login rate limit |
| `LOG_LEVEL` | `info` | |

On boot the server applies SQL migrations (`migrations/0001..0008`), seeds the
plan catalog, and (idempotently) seeds the demo tenancy.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Landlord | `rajesh@example.in` | `Demo@1234` |
| Tenant | `arun@example.in` | `Demo@1234` |

Rajesh owns “Lakeview Apartment, 2BHK” in Bengaluru, with an active tenancy
for Arun, a fully-confirmed agreement, and a confirmed move-in inspection.

## Running tests

Tests run against a real PostgreSQL test database and create it on demand:

```bash
cd backend
go test ./... -count=1
```

`TEST_DATABASE_URL` overrides the default
`postgres://postgres:postgres@localhost:5432/rental_settlement_test?sslmode=disable`.

Covered flows: auth + JWT rotation, users, properties, tenancies, agreements,
inspections, maintenance, deduction accept / dispute negotiation / withdraw,
the full settlement flow (claim → agree → generate → both confirm → SETTLED;
usage released), audit access control, notifications, evidence PDF download,
and demo-data seeding idempotency.

## Style checks

```bash
cd backend
gofmt -w internal tests cmd seeds
go vet ./...
```