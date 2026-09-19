-- 0006_deductions_disputes.sql
-- Deduction claims and structured negotiation (disputes + dispute events).

CREATE TABLE IF NOT EXISTS deduction_claims (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenancy_id           UUID        NOT NULL REFERENCES tenancies (id) ON DELETE CASCADE,
    created_by           UUID        NOT NULL REFERENCES users (id),
    category             TEXT        NOT NULL CHECK (category IN ('UNPAID_RENT', 'UTILITY', 'PROPERTY_DAMAGE', 'MISSING_ITEM', 'CLEANING', 'OTHER')),
    title                TEXT        NOT NULL,
    description          TEXT,
    claimed_amount_minor BIGINT      NOT NULL,
    currency             CHAR(3)     NOT NULL DEFAULT 'INR',
    status               TEXT        NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'ACCEPTED', 'DISPUTED', 'COUNTER_OFFERED', 'AGREED', 'WITHDRAWN')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deduction_claims_tenancy_idx ON deduction_claims (tenancy_id);

CREATE TABLE IF NOT EXISTS disputes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenancy_id        UUID        NOT NULL REFERENCES tenancies (id) ON DELETE CASCADE,
    deduction_claim_id UUID       NOT NULL REFERENCES deduction_claims (id) ON DELETE CASCADE,
    opened_by         UUID        NOT NULL REFERENCES users (id),
    category          TEXT,
    description       TEXT,
    status            TEXT        NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'NEGOTIATING', 'AGREED', 'UNRESOLVED', 'CLOSED')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS disputes_tenancy_idx ON disputes (tenancy_id);
CREATE INDEX IF NOT EXISTS disputes_claim_idx ON disputes (deduction_claim_id);

CREATE TABLE IF NOT EXISTS dispute_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id          UUID        NOT NULL REFERENCES disputes (id) ON DELETE CASCADE,
    actor_id            UUID        NOT NULL REFERENCES users (id),
    action              TEXT        NOT NULL CHECK (action IN ('ACCEPT', 'DISPUTE', 'COUNTER_OFFER', 'WITHDRAW')),
    original_amount_minor BIGINT,
    new_amount_minor    BIGINT,
    reason              TEXT,
    metadata_json       JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dispute_events_dispute_idx ON dispute_events (dispute_id);