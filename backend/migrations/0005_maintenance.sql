-- 0005_maintenance.sql
-- Maintenance requests, history, comments and media.

CREATE TABLE IF NOT EXISTS maintenance_requests (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenancy_id   UUID        NOT NULL REFERENCES tenancies (id) ON DELETE CASCADE,
    reported_by  UUID        NOT NULL REFERENCES users (id),
    title        TEXT        NOT NULL,
    description  TEXT,
    category     TEXT        NOT NULL CHECK (category IN ('PLUMBING', 'ELECTRICAL', 'APPLIANCE', 'STRUCTURAL', 'CLEANING', 'OTHER')),
    priority     TEXT        NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status       TEXT        NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED')),
    reported_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at  TIMESTAMPTZ,
    resolved_by  UUID        REFERENCES users (id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_tenancy_idx ON maintenance_requests (tenancy_id);
CREATE INDEX IF NOT EXISTS maintenance_status_idx ON maintenance_requests (status);

CREATE TABLE IF NOT EXISTS maintenance_history (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests (id) ON DELETE CASCADE,
    previous_status        TEXT NOT NULL,
    new_status             TEXT NOT NULL,
    changed_by             UUID NOT NULL REFERENCES users (id),
    comment                TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_history_mr_idx ON maintenance_history (maintenance_request_id);

CREATE TABLE IF NOT EXISTS maintenance_comments (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests (id) ON DELETE CASCADE,
    user_id                UUID NOT NULL REFERENCES users (id),
    body                   TEXT NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_comments_mr_idx ON maintenance_comments (maintenance_request_id);

CREATE TABLE IF NOT EXISTS maintenance_media (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests (id) ON DELETE CASCADE,
    uploaded_by            UUID NOT NULL REFERENCES users (id),
    file_path              TEXT NOT NULL,
    mime_type              TEXT NOT NULL,
    file_size              BIGINT NOT NULL,
    sha256_hash            TEXT NOT NULL,
    uploaded_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_media_mr_idx ON maintenance_media (maintenance_request_id);