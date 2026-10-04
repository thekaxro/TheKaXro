-- The KaXro Anime catalog additions.
-- Four additional customer-supplied Anime images.
-- Only deploy these files if you have the rights/permission to sell the artwork.

INSERT INTO products (name, description, price, image, category, stock, active) VALUES
('Camera Girl', 'Stylized anime camera-girl frame in a crimson studio scene.', 499, '/assets/anime-camera-girl.jpg', 'Anime', 25, 1),
('Neon Mural', 'Colorful anime-inspired mural portrait frame.', 499, '/assets/anime-neon-mural.jpg', 'Anime', 25, 1),
('Dark Knight', 'Moody armored anime-inspired knight frame.', 499, '/assets/anime-dark-knight.jpg', 'Anime', 25, 1),
('Red Moon Wanderer', 'Dark fantasy anime-inspired wanderer beneath a red moon.', 499, '/assets/anime-red-moon-wanderer.jpg', 'Anime', 25, 1);
