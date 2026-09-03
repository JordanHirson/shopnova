import { z } from "zod"
import { THEME_PRESET_NAMES } from "@/lib/theme"

const hexColor = z
  .string()
  .min(1, "Color is required")
  .regex(/^#?[0-9a-fA-F]{6}$/, "Use a 6-digit hex color, e.g. #334155")

export const storeThemeSchema = z.object({
  themePreset: z.enum(THEME_PRESET_NAMES, {
    errorMap: () => ({ message: "Select a valid theme preset." }),
  }),
  primaryColor: hexColor,
  accentColor: hexColor,
})

export type StoreThemeFormValues = z.infer<typeof storeThemeSchema>
