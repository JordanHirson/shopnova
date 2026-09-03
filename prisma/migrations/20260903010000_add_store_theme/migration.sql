-- Demo Step 1: Store theme customization
--
-- Adds storefront theming columns to the `stores` table so a merchant can
-- pick a preset theme and customize primary/accent colors. All three columns
-- are nullable so existing stores keep the default theme until configured.

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "themePreset" VARCHAR(50),
ADD COLUMN     "primaryColor" VARCHAR(7),
ADD COLUMN     "accentColor" VARCHAR(7);
