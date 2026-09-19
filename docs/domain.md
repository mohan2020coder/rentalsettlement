# Domain & state machines

## Tenancy

Statuses: `INVITED → ACTIVE → NOTICE_GIVEN → MOVE_OUT → SETTLED`, or
`CANCELLED` (from INVITED / ACTIVE / NOTICE_GIVEN).

- Landlord creates a tenancy against one of their properties and invites a
  tenant by email. The invite token is bound to that email.
- The tenant accepts (email must match), tenancy becomes `ACTIVE`.
- **NOTICE_GIVEN**: tenant only, from `ACTIVE` (tenant intends to leave).
- **MOVE_OUT**: landlord or tenant, from `NOTICE_GIVEN` or `ACTIVE`; reached in
  practice when both parties have confirmed the move-out inspection.
- **SETTLED**: landlord or tenant, from `MOVE_OUT`; reached in practice when
  both parties confirmed the settlement.
- **CANCELLED**: landlord only.

An occupying tenancy is one in `INVITED / ACTIVE / NOTICE_GIVEN / MOVE_OUT`;
those count against the tenant/active-tenancy usage limit.

## Inspection

Kinds: `MOVE_IN`, `MOVE_OUT`. Status: `DRAFT → PENDING_CONFIRMATION →
CONFIRMED`.

- A move-out inspection can be started by either party; both confirmations are
  required. When a move-out inspection becomes `CONFIRMED`, the tenancy is
  advanced to `MOVE_OUT`.
- Conditions: `EXCELLENT / GOOD / FAIR / DAMAGED / NOT_PRESENT`. Photos are
  registered as media with SHA-256 + storage keys validated against the
  configured storage root.

## Rental agreement

A series of immutable versions per tenancy. The landlord drafts; each side
approves separately. `fully_confirmed` requires both `landlord_confirmed_at`
and `tenant_confirmed_at`. Terms are structured JSON (rent, deposit, notice,
payment day, clauses, utilities). Money fields are minor units.

## Maintenance

Statuses: `OPEN → ACKNOWLEDGED → IN_PROGRESS → RESOLVED` (or `REJECTED`).
Every transition is recorded in the history table. Both parties can comment;
only the landlord resolves (or rejects). Media attaches like inspections.

## Deduction claim

Path: `PROPOSED → ACCEPTED/AGREED` (tenant accepts), `→ DISPUTED`
(dispute opened) or `→ WITHDRAWN` (landlord withdraws).

- Claims are proposed by the **landlord only**, against a tenancy that is
  `NOTICE_GIVEN` or `MOVE_OUT`.
- Accepting a claim moves it to `AGREED`; agreed claims feed the settlement.

## Dispute (negotiation)

`OPEN → NEGOTIATING → AGREED`.

- Tenant disputes a claim → dispute `OPEN`, claim `DISPUTED`.
- Landlord counter-offers → dispute `NEGOTIATING`, claim `COUNTER_OFFERED`,
  claim amount updated to the offer.
- Tenant accepts the counter-offer → dispute `AGREED`, claim `AGREED`.
- Tenant (or landlord) withdraws → dispute `CLOSED`/`UNRESOLVED`, claim returns
  to `PROPOSED`.
- Every step appends a `dispute_events` row: the full negotiation trail.

## Settlement

`DRAFT → PENDING_CONFIRMATION → CONFIRMED`, one per tenancy (unique index).

- The **landlord** generates the settlement when the tenancy is `MOVE_OUT`.
  It snapshots every `AGREED` claim as an itemized line and computes:

  ```
  total_deduction_minor    = Σ agreed claim amounts
  remaining_amount_minor   = recorded_deposit_minor − total_deduction_minor
  ```

  `remaining_amount_minor` may be negative (the record is informational; it
  tells the parties what refund is due off-platform, or what is still owed).
- Either party may confirm; when **both** have confirmed the settlement becomes
  `CONFIRMED` and the tenancy is advanced to `SETTLED`.
- Events append to `settlement_events`.

## Evidence dossier

Both parties may download a PDF bundling: tenancy + parties, the latest agreed
agreement, all inspections with rooms/items/media, maintenance requests,
deduction claims with the dispute trail, the settlement with items/events, and
the full audit log for the tenancy.