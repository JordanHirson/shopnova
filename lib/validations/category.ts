import { z } from "zod"

export const categorySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or less"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(255, "Slug must be 255 characters or less")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase letters, numbers, and hyphens"
    ),
  description: z
    .string()
    .max(5000, "Description must be 5000 characters or less")
    .optional()
    .nullable(),
})

export type CategoryFormValues = z.infer<typeof categorySchema>