-- Snapshot product name + primary image URL on OrderItem at purchase time,
-- so past orders still show what was bought after a product is renamed
-- or deleted. productName defaults to '' for historical rows so the UI
-- can fall back to the live product name; productImageUrl is nullable.
-- AlterTable
ALTER TABLE "order_items"
  ADD COLUMN "productName" VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN "productImageUrl" VARCHAR(2048);