import { z } from "zod"

export const federationLinkSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or less"),
  source: z
    .string()
    .min(1, "Source is required")
    .max(50, "Source must be 50 characters or less"),
  categoryId: z
    .string()
    .min(1, "A target category is required"),
  markupType: z.enum(["percentage", "fixed"], {
    message: "Choose a markup type",
  }),
  markupValue: z
    .number()
    .min(0, "Markup value must be 0 or greater")
    .max(1_000_000, "Markup value is too large"),
  syncIntervalMinutes: z
    .number()
    .int("Sync interval must be a whole number")
    .min(1, "Sync interval must be at least 1 minute")
    .max(10_080, "Sync interval cannot exceed 7 days"),
})

export type FederationLinkFormValues = z.infer<typeof federationLinkSchema>
