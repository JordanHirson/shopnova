import { z } from "zod"
import {
  descriptionField,
  nameField,
  optionalPriceField,
  priceField,
  slugField,
} from "./common"

export const productSchema = z.object({
  name: nameField,
  slug: slugField,
  description: descriptionField,
  price: priceField("Price"),
  compareAtPrice: optionalPriceField("Compare-at price"),
  sku: z
    .string()
    .max(100, "SKU must be 100 characters or less")
    .optional()
    .nullable(),
  categoryId: z.string().min(1, "Category is required"),
})

export type ProductFormValues = z.infer<typeof productSchema>
