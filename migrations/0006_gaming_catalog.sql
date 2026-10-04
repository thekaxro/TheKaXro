-- The KaXro Gaming catalog.
-- Adds the 10 supplied gaming frames to the Gaming category at ₹99 base price.
-- Safe to run more than once: existing products with the same name are not duplicated.

INSERT INTO products (name, description, price, image, category, stock, active)
SELECT 'Tactical Skull', 'Dark tactical skull gaming frame with black and red lighting.', 99, '/assets/gaming-tactical-skull.jpg', 'Gaming', 25, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tactical Skull');

INSERT INTO products (name, description, price, image, category, stock, active)
SELECT 'Do or Die', 'Monochrome warrior frame with a bold Do or Die title.', 99, '/assets/gaming-do-or-die.jpg', 'Gaming', 25, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Do or Die');

INSERT INTO products (name, description, price, image, category, stock, active)
SELECT 'Gaming Legends', 'Epic multi-game cinematic gaming artwork.', 99, '/assets/gaming-legends.png', 'Gaming', 25, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Gaming Legends');

INSERT INTO products (name, description, price, image, category, stock, active)
SELECT 'Neon Drive', 'Vibrant neon sunset city gaming frame.', 99, '/assets/gaming-neon-drive.jpg', 'Gaming', 25, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Neon Drive');

INSERT INTO products (name, description, price, image, category, stock, active)
SELECT 'Blood Moon', 'Dark fantasy warrior and beast beneath a blood-red moon.', 99, '/assets/gaming-blood-moon.jpg', 'Gaming', 25, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Blood Moon');

INSERT INTO products (name, description, price, image, category, stock, active)
SELECT 'Pixel Realm', 'Colorful pixel-art fantasy world gaming frame.', 99, '/assets/gaming-pixel-realm.jpg', 'Gaming', 25, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pixel Realm');

INSERT INTO products (name, description, price, image, category, stock, active)
SELECT 'Web Warrior', 'Cinematic red-and-black web-slinger gaming frame.', 99, '/assets/gaming-web-warrior.jpg', 'Gaming', 25, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Web Warrior');

INSERT INTO products (name, description, price, image, category, stock, active)
SELECT 'Dragon''s Oath', 'Ink-style fantasy warrior facing a colossal dragon.', 99, '/assets/gaming-dragons-oath.jpg', 'Gaming', 25, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Dragon''s Oath');

INSERT INTO products (name, description, price, image, category, stock, active)
SELECT 'Red Moon Outlaw', 'Western outlaw silhouette against a giant orange-red moon.', 99, '/assets/gaming-red-moon-outlaw.png', 'Gaming', 25, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Red Moon Outlaw');

INSERT INTO products (name, description, price, image, category, stock, active)
SELECT 'Sunset Kingdom', 'Epic block-built fantasy kingdom at sunset.', 99, '/assets/gaming-sunset-kingdom.jpg', 'Gaming', 25, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Sunset Kingdom');

-- Ensure the Gaming products remain active and correctly categorized if this
-- script is re-run after an earlier partial catalog insertion.
UPDATE products
SET price = 99,
    category = 'Gaming',
    active = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE name IN (
  'Tactical Skull', 'Do or Die', 'Gaming Legends', 'Neon Drive', 'Blood Moon',
  'Pixel Realm', 'Web Warrior', 'Dragon''s Oath', 'Red Moon Outlaw', 'Sunset Kingdom'
);

-- Remove the four old default products from the storefront.
UPDATE products
SET active = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (1,2,3,4)
   OR name IN ('Golden Heritage', 'Midnight Drive', 'Royal Minimal', 'The KaXro Signature');
