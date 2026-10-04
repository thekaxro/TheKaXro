-- The KaXro — Personalize product
-- Adds one made-to-order Personalize listing so the Personalize collection is usable immediately.

INSERT INTO products (name, description, price, image, category, stock, active)
SELECT
  'Custom frame',
  'Turn your own photo or Pinterest inspiration into a custom KaXro frame.',
  99,
  '/assets/personalize-frame.svg',
  'Personalize',
  9999,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE category = 'Personalize' AND name = 'Custom frame'
);

UPDATE products
SET description = 'Turn your own photo or Pinterest inspiration into a custom KaXro frame.',
    price = 99,
    image = '/assets/personalize-frame.svg',
    category = 'Personalize',
    stock = CASE WHEN stock < 1 THEN 9999 ELSE stock END,
    active = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE name = 'Custom frame';
