ALTER TABLE orders ADD COLUMN frame_size TEXT NOT NULL DEFAULT 'A4';
ALTER TABLE orders ADD COLUMN personalization_type TEXT NOT NULL DEFAULT 'none';
ALTER TABLE orders ADD COLUMN personalization_value TEXT NOT NULL DEFAULT '';
