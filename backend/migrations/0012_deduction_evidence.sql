-- 0012_deduction_evidence.sql
-- Photo/video evidence attachments for deduction claims.

CREATE TABLE IF NOT EXISTS deduction_claim_evidence (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id    UUID        NOT NULL REFERENCES deduction_claims (id) ON DELETE CASCADE,
    uploaded_by UUID        NOT NULL REFERENCES users (id),
    file_path   TEXT        NOT NULL,
    mime_type   TEXT        NOT NULL,
    file_size   BIGINT      NOT NULL,
    sha256_hash TEXT        NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deduction_claim_evidence_claim_idx ON deduction_claim_evidence (claim_id);