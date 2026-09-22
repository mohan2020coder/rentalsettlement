-- 0010_property_photos.sql
-- Property photos are storage keys pointing at files served by
-- GET /api/v1/storage/*path. They are uploaded via POST /api/v1/storage/upload.

ALTER TABLE properties ADD COLUMN IF NOT EXISTS photo TEXT;