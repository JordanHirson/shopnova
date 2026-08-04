import { z } from "zod"

export const productSchema = z.object({
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
  price: z
    .string()
    .min(1, "Price is required")
    .regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid amount (e.g. 19.99)"),
  compareAtPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Compare-at price must be a valid amount (e.g. 19.99)")
    .optional()
    .nullable()
    .or(z.literal("")),
  sku: z
    .string()
    .max(100, "SKU must be 100 characters or less")
    .optional()
    .nullable(),
  categoryId: z.string().min(1, "Category is required"),
})

export type ProductFormValues = z.infer<typeof productSchema>