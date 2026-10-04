-- The KaXro pricing + catalog metadata update.
-- All active frames are now ₹99 as requested.
UPDATE products SET price = 99 WHERE active = 1;

-- Keep a real Personalize product in the catalog so the existing
-- Pinterest/upload checkout flow can be used from the storefront.
INSERT INTO products (name, description, price, image, category, stock, active)
SELECT 'Your Custom frame', 'Personalized frame using a Pinterest image link or your uploaded image.', 99, '', 'Personalize', 999, 1
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE category = 'Personalize' AND active = 1
);
