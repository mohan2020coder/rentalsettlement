-- 0003_properties_tenancies.sql
-- Properties and tenancies.

CREATE TABLE IF NOT EXISTS properties (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landlord_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    property_name     TEXT        NOT NULL,
    property_type     TEXT        NOT NULL CHECK (property_type IN ('APARTMENT', 'HOUSE', 'VILLA', 'PG', 'OTHER')),
    address_line1     TEXT,
    address_line2     TEXT,
    locality          TEXT,
    city              TEXT,
    state             TEXT,
    postal_code       TEXT,
    bedrooms          INT,
    bathrooms         INT,
    furnishing_status TEXT CHECK (furnishing_status IN ('FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED')),
    description       TEXT,
    status            TEXT        NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS properties_landlord_id_idx ON properties (landlord_id);
CREATE INDEX IF NOT EXISTS properties_status_idx ON properties (status);

CREATE TABLE IF NOT EXISTS tenancies (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id           UUID        NOT NULL REFERENCES properties (id),
    landlord_id           UUID        NOT NULL REFERENCES users (id),
    tenant_id             UUID        REFERENCES users (id),
    invited_email         TEXT,
    invite_token          TEXT        UNIQUE,
    invited_at            TIMESTAMPTZ,
    accepted_at           TIMESTAMPTZ,
    start_date            DATE,
    end_date              DATE,
    monthly_rent_minor    BIGINT      NOT NULL DEFAULT 0,
    security_deposit_minor BIGINT     NOT NULL DEFAULT 0,
    currency              CHAR(3)     NOT NULL DEFAULT 'INR',
    notice_period_days    INT         NOT NULL DEFAULT 0,
    rent_due_day          INT         CHECK (rent_due_day BETWEEN 1 AND 31),
    agreement_reference   TEXT,
    status                TEXT        NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED', 'ACTIVE', 'NOTICE_GIVEN', 'MOVE_OUT', 'SETTLED', 'CANCELLED')),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenancies_property_id_idx ON tenancies (property_id);
CREATE INDEX IF NOT EXISTS tenancies_landlord_id_idx ON tenancies (landlord_id);
CREATE INDEX IF NOT EXISTS tenancies_tenant_id_idx ON tenancies (tenant_id);
CREATE INDEX IF NOT EXISTS tenancies_status_idx ON tenancies (status);