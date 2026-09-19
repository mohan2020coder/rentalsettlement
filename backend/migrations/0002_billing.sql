-- 0002_billing.sql
-- Plans, subscriptions and usage metrics (business model module).

CREATE TABLE IF NOT EXISTS plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                TEXT        NOT NULL UNIQUE,
    name                TEXT        NOT NULL,
    description         TEXT,
    price_minor         BIGINT      NOT NULL DEFAULT 0,
    currency            CHAR(3)     NOT NULL DEFAULT 'INR',
    billing_interval    TEXT        NOT NULL DEFAULT 'MONTHLY' CHECK (billing_interval IN ('MONTHLY', 'YEARLY')),
    max_properties      BIGINT      NOT NULL DEFAULT 0,
    max_active_tenancies BIGINT     NOT NULL DEFAULT 0,
    max_storage_mb      BIGINT      NOT NULL DEFAULT 0,
    features_json       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    is_active           BOOLEAN     NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    plan_id                 UUID        NOT NULL REFERENCES plans (id),
    status                  TEXT        NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED')),
    started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at              TIMESTAMPTZ,
    provider                TEXT,
    provider_customer_id    TEXT,
    provider_subscription_id TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_current              BOOLEAN     NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_current_uniq
    ON subscriptions (user_id) WHERE is_current = true;

CREATE TABLE IF NOT EXISTS usage_metrics (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    resource_type TEXT        NOT NULL,
    current_value BIGINT      NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, resource_type)
);

CREATE TABLE IF NOT EXISTS usage_records (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    resource_type TEXT      NOT NULL,
    delta       BIGINT      NOT NULL DEFAULT 0,
    entity_id   UUID,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_records_user_id_idx ON usage_records (user_id);