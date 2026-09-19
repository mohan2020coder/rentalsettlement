-- 0001_users.sql
-- Users and refresh tokens (authentication).

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT        NOT NULL,
    email         TEXT        NOT NULL,
    phone         TEXT,
    password_hash TEXT        NOT NULL,
    role          TEXT        NOT NULL CHECK (role IN ('LANDLORD', 'TENANT')),
    profile_photo TEXT,
    status        TEXT        NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_uniq ON users (lower(email));
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_active_idx ON refresh_tokens (user_id) WHERE revoked_at IS NULL;