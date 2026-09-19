-- 0007_settlements.sql
-- Settlement records and itemized agreed deductions.

CREATE TABLE IF NOT EXISTS settlements (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenancy_id              UUID        NOT NULL REFERENCES tenancies (id) ON DELETE CASCADE,
    status                  TEXT        NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED')),
    version_number          INT         NOT NULL DEFAULT 1,
    recorded_deposit_minor  BIGINT      NOT NULL DEFAULT 0,
    total_deduction_minor   BIGINT      NOT NULL DEFAULT 0,
    remaining_amount_minor  BIGINT      NOT NULL DEFAULT 0,
    currency                CHAR(3)     NOT NULL DEFAULT 'INR',
    proposed_by             UUID        REFERENCES users (id),
    landlord_confirmed_at   TIMESTAMPTZ,
    tenant_confirmed_at     TIMESTAMPTZ,
    confirmed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS settlements_tenancy_uniq ON settlements (tenancy_id);

CREATE TABLE IF NOT EXISTS settlement_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id       UUID        NOT NULL REFERENCES settlements (id) ON DELETE CASCADE,
    deduction_claim_id  UUID        REFERENCES deduction_claims (id) ON DELETE SET NULL,
    category            TEXT        NOT NULL,
    title               TEXT        NOT NULL,
    amount_minor        BIGINT      NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS settlement_items_settlement_idx ON settlement_items (settlement_id);

CREATE TABLE IF NOT EXISTS settlement_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID        NOT NULL REFERENCES settlements (id) ON DELETE CASCADE,
    actor_id      UUID        NOT NULL REFERENCES users (id),
    action        TEXT        NOT NULL,
    amount_minor  BIGINT,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS settlement_events_settlement_idx ON settlement_events (settlement_id);