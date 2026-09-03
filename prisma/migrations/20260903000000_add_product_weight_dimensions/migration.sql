-- Post-MVP #5: Per-product weight & dimensions
--
-- Additive, nullable physical-characteristic columns on the purchasable
-- `products` table so live courier adapters (e.g. Bob Go) can quote using the
-- actual goods being shipped. All four columns are nullable so existing
-- products remain valid; the shipping layer treats NULL (and zero) as
-- "not specified" and falls back to the documented conservative defaults.
-- Integer grams/centimetres keep the schema consistent with the existing
-- Int-based inventory fields.

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "heightCm" INTEGER,
ADD COLUMN     "lengthCm" INTEGER,
ADD COLUMN     "weightGrams" INTEGER,
ADD COLUMN     "widthCm" INTEGER;
