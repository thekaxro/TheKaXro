ALTER TABLE orders ADD COLUMN coupon_code TEXT NOT NULL DEFAULT '';

CREATE TRIGGER IF NOT EXISTS coupons_enforce_max_uses
BEFORE UPDATE OF used_count ON coupons
WHEN NEW.max_uses IS NOT NULL AND NEW.used_count > NEW.max_uses
BEGIN
  SELECT RAISE(ABORT, 'coupon max uses reached');
END;

CREATE TRIGGER IF NOT EXISTS products_stock_nonnegative
BEFORE UPDATE OF stock ON products
WHEN NEW.stock < 0
BEGIN
  SELECT RAISE(ABORT, 'product stock cannot be negative');
END;

CREATE TRIGGER IF NOT EXISTS orders_coupon_valid
BEFORE INSERT ON orders
WHEN NEW.coupon_code <> ''
  AND NOT EXISTS (
    SELECT 1 FROM coupons
    WHERE code = NEW.coupon_code COLLATE NOCASE
      AND active = 1
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      AND (max_uses IS NULL OR used_count < max_uses)
  )
BEGIN
  SELECT RAISE(ABORT, 'coupon invalid or max uses reached');
END;
