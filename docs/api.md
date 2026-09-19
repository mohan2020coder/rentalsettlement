# API reference

Base path: `/api/v1`. All endpoints return the envelope:

```json
{ "success": true, "data": … }
```
or, on error:
```json
{ "success": false, "error": { "code": "TENANCY_NOT_FOUND", "message": "…", "details": {…} } }
```

Authenticated calls use `Authorization: Bearer <access_token>`. Access tokens
expire in 15 minutes; refresh via `POST /auth/refresh`.

## Auth (public except logout)

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | create account (role `LANDLORD`/`TENANT`), returns access+refresh |
| POST | `/auth/login` | rate-limited (2/sec burst 4) |
| POST | `/auth/refresh` | rotate refresh token (jti-bound, stored hashed) |
| POST | `/auth/logout` | revoke refresh token |

## Users

| Method | Path | Notes |
|---|---|---|
| GET | `/users/me` | profile |
| PATCH | `/users/me` | update name/phone/photo |

## Billing

| Method | Path | Notes |
|---|---|---|
| GET | `/billing/plans` | public catalog |
| GET | `/billing/subscription` | current plan + status |
| GET | `/billing/usage` | `{property_count, active_tenancy_count, storage_bytes}` |
| POST | `/billing/change-plan` | simulated plan change, body `{"plan_code":"LANDLORD"}` |

## Properties

| Method | Path | Notes |
|---|---|---|
| POST | `/properties` | create (owner only; plan limit enforced) |
| GET | `/properties` | my properties |
| GET | `/properties/:id` | owner only |
| PATCH | `/properties/:id` | owner only |

## Tenancies

| Method | Path | Notes |
|---|---|---|
| POST | `/tenancies` | create + invite tenant by email (plan limit enforced) |
| GET | `/tenancies` | my tenancies |
| GET | `/tenancies/:id` | party only |
| POST | `/tenancies/:id/invite` | regenerate invite token (landlord) |
| POST | `/tenancies/:id/accept` | tenant accepts, body `{"invite_token":"…"}` |
| POST | `/tenancies/:id/status` | body `{"status":"MOVE_OUT"}`; state machine enforced |

## Agreements

| Method | Path | Notes |
|---|---|---|
| GET | `/agreements/tenancy/:id/current` | latest version |
| GET | `/agreements/tenancy/:id/versions` | all versions |
| POST | `/agreements/tenancy/:id/versions` | landlord drafts a new version |
| POST | `/agreements/tenancy/:id/versions/:version/approve` | either party approves once |

## Inspections

| Method | Path | Notes |
|---|---|---|
| GET | `/inspections/tenancy/:tenancyID` | list |
| POST | `/inspections/tenancy/:tenancyID/move-in` | create move-in (landlord) |
| POST | `/inspections/tenancy/:tenancyID/move-out` | create move-out (either party) |
| GET | `/inspections/:id` | party only |
| PUT | `/inspections/:id/rooms/:roomID/items/:itemID` | save condition + notes |
| POST | `/inspections/:id/media` | register an upload (validated storage key) |
| POST | `/inspections/:id/confirm` | one party; both → CONFIRMED |

## Maintenance

| Method | Path | Notes |
|---|---|---|
| GET | `/maintenance/tenancy/:tenancyID` | list |
| POST | `/maintenance/tenancy/:tenancyID` | report issue (either party) |
| GET | `/maintenance/:id` | request + history |
| GET/POST | `/maintenance/:id/comments` | thread |
| POST | `/maintenance/:id/media` | attach photos |
| POST | `/maintenance/:id/status` | transition (landlord resolves) |

## Deductions & disputes

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/deductions/tenancy/:tenancyID` | list / propose (landlord, tenancy in NOTICE_GIVEN or MOVE_OUT) |
| GET | `/deductions/:id` | claim + disputes |
| POST | `/deductions/:id/accept` | tenant accepts → claim AGREED |
| POST | `/deductions/:id/dispute` | tenant disputes, body `{"reason":"…"}` → claim DISPUTED |
| POST | `/deductions/:id/withdraw` | landlord withdraws → PROPOSED |
| GET | `/disputes/tenancy/:tenancyID` | disputes for a tenancy |
| GET | `/disputes/:id` | dispute + event trail |
| POST | `/disputes/:id/accept` | accepts current offer → AGREED |
| POST | `/disputes/:id/counter-offer` | body `{"new_amount_minor":…,"reason":"…"}` (landlord) |
| POST | `/disputes/:id/withdraw` | tenant closes negotiation → claim back to PROPOSED |

## Settlements

| Method | Path | Notes |
|---|---|---|
| GET | `/settlements/tenancy/:tenancyID` | party only |
| POST | `/settlements/tenancy/:tenancyID` | landlord generates from AGREED claims (tenancy MOVE_OUT) |
| POST | `/settlements/tenancy/:tenancyID/confirm` | both parties → CONFIRMED + tenancy SETTLED |

## Notifications

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications` | newest first (max 50) |
| GET | `/notifications/unread-count` | |
| POST | `/notifications/read-all` | |
| POST | `/notifications/:id/read` | |

## Audit

| Method | Path | Notes |
|---|---|---|
| GET | `/audit/me` | my actions |
| GET | `/audit/tenancy/:tenancyID` | party only (append-only trail) |

## Evidence

| Method | Path | Notes |
|---|---|---|
| GET | `/evidence/tenancy/:tenancyID/download` | PDF dossier, party only |

## Error codes (selection)

`VALIDATION_ERROR`, `INVALID_JSON`, `INVALID_ID`, `UNAUTHORIZED`,
`INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `FORBIDDEN`, `NOT_FOUND`,
`TENANCY_NOT_FOUND`, `PLAN_LIMIT_REACHED`, `INVALID_STATE`,
`ALREADY_CONFIRMED`, `SETTLEMENT_EXISTS`, `SETTLEMENT_NOT_FOUND`,
`INVITE_EMAIL_MISMATCH`, `NOTIFICATION_NOT_FOUND`, `PLAN_INACTIVE`,
`STORAGE_KEY_INVALID`.