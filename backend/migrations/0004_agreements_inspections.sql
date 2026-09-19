-- 0004_agreements_inspections.sql
-- Versioned rental agreements and move-in/move-out inspections.

CREATE TABLE IF NOT EXISTS rental_agreement_versions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenancy_id            UUID        NOT NULL REFERENCES tenancies (id) ON DELETE CASCADE,
    version_number        INT         NOT NULL,
    terms_json            JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_by            UUID        NOT NULL REFERENCES users (id),
    landlord_confirmed_at TIMESTAMPTZ,
    tenant_confirmed_at   TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenancy_id, version_number)
);

CREATE INDEX IF NOT EXISTS agreement_versions_tenancy_idx ON rental_agreement_versions (tenancy_id);

CREATE TABLE IF NOT EXISTS inspections (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenancy_id    UUID        NOT NULL REFERENCES tenancies (id) ON DELETE CASCADE,
    kind          TEXT        NOT NULL CHECK (kind IN ('MOVE_IN', 'MOVE_OUT')),
    status        TEXT        NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED')),
    conducted_at  TIMESTAMPTZ,
    conducted_by  UUID        REFERENCES users (id),
    notes         TEXT,
    created_by    UUID        NOT NULL REFERENCES users (id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspections_tenancy_idx ON inspections (tenancy_id, kind);

CREATE TABLE IF NOT EXISTS inspection_rooms (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES inspections (id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    sort_order    INT  NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspection_rooms_inspection_idx ON inspection_rooms (inspection_id);

CREATE TABLE IF NOT EXISTS inspection_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id    UUID NOT NULL REFERENCES inspection_rooms (id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    condition  TEXT NULL CHECK (condition IN ('EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'NOT_PRESENT')),
    notes      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspection_items_room_idx ON inspection_items (room_id);

CREATE TABLE IF NOT EXISTS inspection_media (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID        NOT NULL REFERENCES inspections (id) ON DELETE CASCADE,
    room_id       UUID        REFERENCES inspection_rooms (id) ON DELETE SET NULL,
    item_id       UUID        REFERENCES inspection_items (id) ON DELETE SET NULL,
    uploaded_by   UUID        NOT NULL REFERENCES users (id),
    file_path     TEXT        NOT NULL,
    mime_type     TEXT        NOT NULL,
    file_size     BIGINT      NOT NULL,
    sha256_hash   TEXT        NOT NULL,
    captured_at   TIMESTAMPTZ,
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspection_media_inspection_idx ON inspection_media (inspection_id);

CREATE TABLE IF NOT EXISTS inspection_confirmations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID        NOT NULL REFERENCES inspections (id) ON DELETE CASCADE,
    user_id       UUID        NOT NULL REFERENCES users (id),
    confirmed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (inspection_id, user_id)
);

CREATE INDEX IF NOT EXISTS inspection_confirmations_inspection_idx ON inspection_confirmations (inspection_id);