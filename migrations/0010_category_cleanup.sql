-- KaXro Frames category cleanup
-- Rename the legacy Gaming category to Games without creating generic collection products.
UPDATE products
SET category = 'Games', updated_at = CURRENT_TIMESTAMP
WHERE category = 'Gaming';

-- Animals and Fantasy are storefront categories. Products can be added to each category from the owner dashboard.
