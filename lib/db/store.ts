import { prisma } from "./prisma"
import { normalizeHex, isThemePresetName, DEFAULT_THEME_PRESET } from "@/lib/theme"

/**
 * Returns the first store in the database.
 *
 * Authentication is not implemented yet, so the dashboard operates
 * against a single default store. This helper centralizes that lookup.
 */
export async function getDefaultStore() {
  return prisma.store.findFirst({
    orderBy: { createdAt: "asc" },
  })
}

/**
 * Returns the id of the default store, or null if no store exists.
 */
export async function getDefaultStoreId(): Promise<string | null> {
  const store = await getDefaultStore()
  return store?.id ?? null
}

/**
 * Persists the storefront theme (preset name + primary/accent colors) for the
 * default store. Inputs are normalized before writing so the DB never holds a
 * malformed hex or an unknown preset name.
 */
export async function updateDefaultStoreTheme(input: {
  themePreset: string
  primaryColor: string
  accentColor: string
}) {
  const store = await getDefaultStore()
  if (!store) {
    throw new Error("No store found. Run the seed before updating theme settings.")
  }

  const themePreset = isThemePresetName(input.themePreset)
    ? input.themePreset
    : DEFAULT_THEME_PRESET

  const primaryColor = normalizeHex(input.primaryColor)
  const accentColor = normalizeHex(input.accentColor)
  if (!primaryColor || !accentColor) {
    throw new Error("Invalid color values.")
  }

  return prisma.store.update({
    where: { id: store.id },
    data: { themePreset, primaryColor, accentColor },
    select: { id: true, themePreset: true, primaryColor: true, accentColor: true },
  })
}