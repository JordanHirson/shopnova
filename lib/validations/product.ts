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
  imageUrl: z
    .string()
    .url("Image URL must be a valid URL")
    .max(2048, "Image URL must be 2048 characters or less")
    .optional()
    .or(z.literal("")),
  stock: z
    .string()
    .regex(/^\d+$/, "Stock must be a non-negative integer")
    .optional()
    .or(z.literal("")),

  // ── Physical characteristics (optional, post-MVP #5) ──
  // Non-negative integer strings (grams / centimetres). Negative and
  // non-integer values are rejected. Zero is accepted by validation but
  // treated as "not specified" by the shipping layer (which falls back to
  // the documented conservative defaults). All four accept null/empty/omitted
  // so existing products without physical metadata remain valid.
  weightGrams: z
    .string()
    .regex(/^\d+$/, "Weight must be a non-negative integer (grams)")
    .optional()
    .nullable()
    .or(z.literal("")),
  lengthCm: z
    .string()
    .regex(/^\d+$/, "Length must be a non-negative integer (cm)")
    .optional()
    .nullable()
    .or(z.literal("")),
  widthCm: z
    .string()
    .regex(/^\d+$/, "Width must be a non-negative integer (cm)")
    .optional()
    .nullable()
    .or(z.literal("")),
  heightCm: z
    .string()
    .regex(/^\d+$/, "Height must be a non-negative integer (cm)")
    .optional()
    .nullable()
    .or(z.literal("")),
})

export type ProductFormValues = z.infer<typeof productSchema>