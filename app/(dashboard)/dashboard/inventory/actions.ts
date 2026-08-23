"use server"

import { revalidatePath } from "next/cache"
import { inventoryUpdateSchema } from "@/lib/validations/inventory"
import { updateInventory } from "@/lib/db"
import {
  requireAdmin,
  AdminRequiredError,
  UnauthenticatedError,
} from "@/lib/auth/admin"

export type InventoryActionState = {
  error?: string
}

function errorMessage(err: unknown): string {
  if (err instanceof UnauthenticatedError) return err.message
  if (err instanceof AdminRequiredError) return err.message
  return err instanceof Error ? err.message : "Something went wrong."
}

export async function updateInventoryAction(
  _prevState: InventoryActionState,
  formData: FormData
): Promise<InventoryActionState> {
  // SECURITY: authorize before any DB writes.
  try {
    await requireAdmin()
  } catch (err) {
    return { error: errorMessage(err) }
  }

  const productId = formData.get("productId")
  if (typeof productId !== "string" || !productId) {
    return { error: "Product id is required." }
  }

  const quantityRaw = formData.get("quantity")
  const thresholdRaw = formData.get("lowStockThreshold")

  const parsed = inventoryUpdateSchema.safeParse({
    productId,
    quantity:
      quantityRaw === null || quantityRaw === ""
        ? undefined
        : Number(quantityRaw),
    lowStockThreshold:
      thresholdRaw === null || thresholdRaw === ""
        ? undefined
        : Number(thresholdRaw),
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid inventory data.",
    }
  }

  try {
    await updateInventory(parsed.data.productId, {
      quantity: parsed.data.quantity,
      lowStockThreshold: parsed.data.lowStockThreshold,
    })
    revalidatePath("/dashboard/inventory")
    revalidatePath("/products")
    return {}
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update inventory.",
    }
  }
}
