/**
 * ShopNova — Storefront theming (Demo Step 1).
 *
 * Centralizes the three selectable theme presets, their default colors, and
 * the helpers used to resolve a store's active colors. Both the dashboard
 * customizer and the storefront layout import from here so the source of
 * truth for preset colors stays in one place.
 */

/** Selectable preset theme names shown in the dashboard customizer. */
export const THEME_PRESET_NAMES = [
  "Modern Slate",
  "Warm Artisan",
  "Neon Cyber",
] as const

export type ThemePresetName = (typeof THEME_PRESET_NAMES)[number]

export interface ThemePreset {
  name: ThemePresetName
  description: string
  primaryColor: string
  accentColor: string
}

/**
 * The three demo presets. Colors are hex strings so they can be applied
 * directly to CSS custom properties (`--primary`, `--accent`).
 */
export const THEME_PRESETS: Record<ThemePresetName, ThemePreset> = {
  "Modern Slate": {
    name: "Modern Slate",
    description: "Cool slate neutrals with a crisp sky accent.",
    primaryColor: "#334155",
    accentColor: "#0ea5e9",
  },
  "Warm Artisan": {
    name: "Warm Artisan",
    description: "Earthy amber tones for a handcrafted feel.",
    primaryColor: "#92400e",
    accentColor: "#f59e0b",
  },
  "Neon Cyber": {
    name: "Neon Cyber",
    description: "Bold violet primary with an electric cyan accent.",
    primaryColor: "#6d28d9",
    accentColor: "#22d3ee",
  },
}

/** Ordered list of presets for rendering selector buttons. */
export const THEME_PRESET_LIST: ThemePreset[] = THEME_PRESET_NAMES.map(
  (name) => THEME_PRESETS[name]
)

/** The preset applied when a store has no theme configured yet. */
export const DEFAULT_THEME_PRESET: ThemePresetName = "Modern Slate"

export interface StoreTheme {
  themePreset: ThemePresetName
  primaryColor: string
  accentColor: string
}

/**
 * Resolves a store's active theme, falling back to the default preset when
 * any field is missing or invalid. Accepts the raw nullable columns from the
 * Store model so callers can pass them through directly.
 */
export function resolveStoreTheme(input: {
  themePreset: string | null
  primaryColor: string | null
  accentColor: string | null
}): StoreTheme {
  const presetName = isThemePresetName(input.themePreset)
    ? input.themePreset
    : DEFAULT_THEME_PRESET

  const preset = THEME_PRESETS[presetName]

  return {
    themePreset: presetName,
    primaryColor: normalizeHex(input.primaryColor) ?? preset.primaryColor,
    accentColor: normalizeHex(input.accentColor) ?? preset.accentColor,
  }
}

export function isThemePresetName(value: unknown): value is ThemePresetName {
  return (
    typeof value === "string" &&
    (THEME_PRESET_NAMES as readonly string[]).includes(value)
  )
}

/** Returns a normalized `#rrggbb` hex string, or null if invalid. */
export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  const match = /^#?([0-9a-fA-F]{6})$/.exec(trimmed)
  if (!match) return null
  return `#${match[1].toLowerCase()}`
}

/**
 * Builds the CSS declarations that apply a store's theme to the storefront.
 * Returns a string suitable for a `<style>` tag scoped to `:root`.
 */
export function themeCssText(theme: StoreTheme): string {
  return [
    `--primary: ${theme.primaryColor};`,
    `--accent: ${theme.accentColor};`,
  ].join(" ")
}
