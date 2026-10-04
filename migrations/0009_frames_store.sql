-- The KaXro Frames storefront update
-- Checkout size prices below are for framed wall art.

UPDATE products
SET description = CASE
  WHEN category = 'Personalize' THEN 'Create a custom framed piece from your own photo or Pinterest inspiration.'
  ELSE description
END,
updated_at = CURRENT_TIMESTAMP
WHERE active = 1;

UPDATE products
SET price = 249, updated_at = CURRENT_TIMESTAMP
WHERE active = 1 AND category IN ('Anime','Gaming','Cars','Minimal');

UPDATE products
SET price = 299, updated_at = CURRENT_TIMESTAMP
WHERE active = 1 AND category = 'Personalize';
