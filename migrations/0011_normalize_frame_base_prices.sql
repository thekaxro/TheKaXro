-- KaXro frame pricing: product base price is the A4 starting price.
-- Checkout uses the selected size: A4 249, A3 399, A2 599, A1 899.
UPDATE products
SET price = 249, updated_at = CURRENT_TIMESTAMP
WHERE active = 1 AND category IN ('Anime','Games','Cars','Minimal','Animals','Fantasy','Personalize');
