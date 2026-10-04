-- The KaXro frame catalog additions.
-- Uses the eight customer-supplied images as local Cloudflare Assets.
-- Only deploy these files if you have the rights/permission to sell the artwork.

INSERT INTO products (name, description, price, image, category, stock, active) VALUES
('Flame Dragon', 'Anime-inspired flame and dragon frame.', 499, '/assets/anime-flame-dragon.jpg', 'Anime', 25, 1),
('Golden Warrior', 'High-energy golden warrior frame.', 499, '/assets/anime-golden-warrior.jpg', 'Anime', 25, 1),
('Crimson Shinobi', 'Black, white and crimson shinobi frame.', 499, '/assets/anime-crimson-shinobi.jpg', 'Anime', 25, 1),
('Red Moon Ronin', 'Dark ronin silhouette with red moon frame.', 449, '/assets/anime-red-moon-ronin.jpg', 'Anime', 25, 1),
('Straw Hat', 'Bold illustrated straw-hat character frame.', 449, '/assets/anime-straw-hat.jpg', 'Anime', 25, 1),
('Orange Shinobi', 'Bright orange anime-inspired character frame.', 499, '/assets/anime-orange-shinobi.jpg', 'Anime', 25, 1),
('Mountain Sky', 'Peaceful anime mountain landscape frame.', 399, '/assets/anime-mountain-sky.jpg', 'Anime', 25, 1),
('Water Blade', 'Dynamic water-action anime-inspired frame.', 499, '/assets/anime-water-blade.jpg', 'Anime', 25, 1);
