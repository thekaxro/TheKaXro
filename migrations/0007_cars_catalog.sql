-- The KaXro Cars catalog.
-- Adds the 17 supplied automotive frames to the Cars category at ₹99 base price.
-- Safe to run more than once: existing products with the same name are not duplicated.

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'McLaren Senna', 'Premium McLaren Senna automotive frame.', 99, '/assets/minimal-mclaren-senna.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'McLaren Senna');

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'Nissan Skyline', 'Minimal Nissan Skyline automotive frame.', 99, '/assets/minimal-nissan-skyline.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Nissan Skyline');

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'Supra Power & Precision', 'Toyota Supra automotive frame focused on power and precision.', 99, '/assets/minimal-supra-power-precision.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Supra Power & Precision');

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'BMW Front', 'Minimal BMW automotive frame.', 99, '/assets/minimal-bmw-front.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'BMW Front');

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'Supra Japanese Red Sun', 'Toyota Supra Japanese red-sun automotive frame.', 99, '/assets/minimal-supra-japanese-red-sun.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Supra Japanese Red Sun');

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'Supra Black & White', 'Black and white Toyota Supra automotive frame.', 99, '/assets/minimal-supra-black-white.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Supra Black & White');

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'Mustang Shelby GT500', 'Ford Mustang Shelby GT500 automotive frame.', 99, '/assets/minimal-mustang-shelby-gt500.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mustang Shelby GT500');

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'BMW E30 M3', 'BMW E30 M3 automotive frame.', 99, '/assets/minimal-bmw-e30-m3.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'BMW E30 M3');

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'Silver Supercar', 'Minimal silver supercar frame.', 99, '/assets/minimal-supercar-grey.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Silver Supercar');

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'BMW Race', 'Minimal BMW race-car frame.', 99, '/assets/minimal-bmw-race.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'BMW Race');

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'Audi R8 V10', 'Minimal Audi R8 V10 automotive frame.', 99, '/assets/minimal-audi-r8-v10.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Audi R8 V10');

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'Range Rover', 'Minimal Range Rover automotive frame.', 99, '/assets/minimal-range-rover.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Range Rover');

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'Nissan GTR Pink', 'Nissan GT-R pink automotive frame.', 99, '/assets/minimal-nissan-gtr-pink.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Nissan GTR Pink');

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'Nissan GTR Red', 'Nissan GT-R red automotive frame.', 99, '/assets/minimal-nissan-gtr-red.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Nissan GTR Red');

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'Mazda RX-7 Red', 'Mazda RX-7 red automotive frame.', 99, '/assets/minimal-mazda-rx7-red.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mazda RX-7 Red');

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'Bugatti Tourbillon', 'Minimal Bugatti Tourbillon automotive frame.', 99, '/assets/minimal-bugatti-tourbillon.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Bugatti Tourbillon');

INSERT INTO products (name, description, price, image, category, stock, active) SELECT 'Mazda RX-7 Purple', 'Mazda RX-7 purple automotive frame.', 99, '/assets/minimal-mazda-rx7-purple.jpg', 'Cars', 25, 1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mazda RX-7 Purple');

UPDATE products SET price=99, category='Cars', active=1, updated_at=CURRENT_TIMESTAMP WHERE name IN ('McLaren Senna', 'Nissan Skyline', 'Supra Power & Precision', 'BMW Front', 'Supra Japanese Red Sun', 'Supra Black & White', 'Mustang Shelby GT500', 'BMW E30 M3', 'Silver Supercar', 'BMW Race', 'Audi R8 V10', 'Range Rover', 'Nissan GTR Pink', 'Nissan GTR Red', 'Mazda RX-7 Red', 'Bugatti Tourbillon', 'Mazda RX-7 Purple');
