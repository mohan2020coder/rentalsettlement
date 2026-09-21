-- 0009_applications.sql
-- Marketplace: listing flags, offer terms on properties, and tenant visit/rent
-- applications that drive the in-app tenancy invitation flow.

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS listed BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS monthly_rent_minor BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS security_deposit_minor BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'INR';

CREATE INDEX IF NOT EXISTS properties_listed_idx ON properties (listed, status);

CREATE TABLE IF NOT EXISTS property_applications (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id    UUID        NOT NULL REFERENCES properties (id),
    tenant_id      UUID        NOT NULL REFERENCES users (id),
    landlord_id    UUID        NOT NULL REFERENCES users (id),
    status         TEXT        NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    preferred_date DATE,
    note           TEXT,
    decided_by     UUID        REFERENCES users (id),
    decided_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_applications_property_idx ON property_applications (property_id, status);
CREATE INDEX IF NOT EXISTS property_applications_tenant_idx ON property_applications (tenant_id);
CREATE INDEX IF NOT EXISTS property_applications_landlord_idx ON property_applications (landlord_id);
CREATE UNIQUE INDEX IF NOT EXISTS property_applications_pending_unique
    ON property_applications (property_id, tenant_id) WHERE status = 'PENDING';