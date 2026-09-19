# Billing & limits

## Plans

Plans live in the database (`plans`) and are seeded by `seeds.SeedPlans`.
Registration always assigns the **FREE** plan.

| Code | Name | Price | Properties | Active tenancies | Storage |
|---|---|---|---|---|---|
| `FREE` | Free | ₹0 | 1 | 1 | 100 MB |
| `LANDLORD` | Landlord | ₹499 | 10 | 10 | 5 GB |
| `PROPERTY_MANAGER` | Property Manager | ₹1,499 | 50 | 50 | 20 GB |

All prices are stored as minor units (`price_minor`) with currency `INR`.

## Usage metering

Counters are maintained in `usage_metrics` via a row-lock upsert so concurrent
writes stay consistent; every adjustment also appends an entry to
`usage_records`:

- `PROPERTY_COUNT` — increments on property create, decrements on delete (if a
  delete existed; properties are currently created/updated only).
- `ACTIVE_TENANCY_COUNT` — incremented when a tenancy starts occupying, and
  decremented when it leaves the occupying set (SETTLED / CANCELLED).
- `STORAGE_BYTES` — adjusted when inspection/maintenance media are registered.

Entitlement checks run **before** the write. When a limit would be exceeded the
request fails with `PLAN_LIMIT_REACHED` and nothing is written.

## Endpoints

- `GET /billing/usage` → current counters (the shape is a flat object, **not**
  a metrics map):

```json
{ "success": true, "data": { "property_count": 1, "active_tenancy_count": 1, "storage_bytes": 0 } }
```

- `POST /billing/change-plan` is a **simulation** for the MVP: it closes the
  current subscription row and opens a new current one. There is no real
  payment processing; `PaymentProvider` is a named future seam.