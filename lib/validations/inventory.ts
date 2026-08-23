import { z } from "zod"

export const inventoryUpdateSchema = z.object({
  productId: z.string().min(1, "Product id is required"),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(0, "Quantity cannot be negative")
    .optional(),
  lowStockThreshold: z
    .number()
    .int("Low-stock threshold must be a whole number")
    .min(0, "Low-stock threshold cannot be negative")
    .optional(),
}).refine(
  (data) => data.quantity !== undefined || data.lowStockThreshold !== undefined,
  { message: "Provide a quantity or a low-stock threshold to update." }
)

export type InventoryUpdateValues = z.infer<typeof inventoryUpdateSchema>
