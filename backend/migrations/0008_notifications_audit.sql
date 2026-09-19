-- 0008_notifications_audit.sql
-- Notifications and the append-only audit log.

CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type        TEXT        NOT NULL,
    title       TEXT        NOT NULL,
    body        TEXT,
    entity_type TEXT,
    entity_id   UUID,
    is_read     BOOLEAN     NOT NULL DEFAULT false,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, is_read);

CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID REFERENCES users (id),
    tenancy_id  UUID REFERENCES tenancies (id),
    action      TEXT        NOT NULL,
    entity_type TEXT        NOT NULL,
    entity_id   UUID,
    metadata_json JSONB,
    ip_address  TEXT,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_tenancy_idx ON audit_logs (tenancy_id, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);