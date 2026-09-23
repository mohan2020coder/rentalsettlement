-- 0011_property_photos.sql
-- Multiple photos per property. Each row holds a storage key of a photo
-- uploaded via POST /api/v1/storage/upload and served by
-- GET /api/v1/storage/*path. Sort order is 0-based; the first photo is the
-- cover and mirrors properties.photo for backward compatibility.

CREATE TABLE IF NOT EXISTS property_photos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID        NOT NULL REFERENCES properties (id) ON DELETE CASCADE,
    file_path   TEXT        NOT NULL,
    sort_order  INT         NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (property_id, file_path)
);

CREATE INDEX IF NOT EXISTS property_photos_property_id_idx ON property_photos (property_id);

-- Backfill the table from the single legacy photo column so existing
-- properties keep showing their cover image everywhere.
INSERT INTO property_photos (property_id, file_path, sort_order)
SELECT id, photo, 0
FROM properties
WHERE photo IS NOT NULL AND photo <> ''
ON CONFLICT (property_id, file_path) DO NOTHING;