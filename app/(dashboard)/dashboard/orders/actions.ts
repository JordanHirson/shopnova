"use server"

import { revalidatePath } from "next/cache"
import { updateOrderStatus } from "@/lib/db"
import { normalizeOrderStatus } from "@/features/admin/admin-logic"
import {
  requireAdmin,
  AdminRequiredError,
  UnauthenticatedError,
} from "@/lib/auth/admin"

export type OrderStatusActionState = {
  error?: string
}

function errorMessage(err: unknown): string {
  if (err instanceof UnauthenticatedError) return err.message
  if (err instanceof AdminRequiredError) return err.message
  return err instanceof Error ? err.message : "Something went wrong."
}

export async function updateOrderStatusAction(
  _prevState: OrderStatusActionState,
  formData: FormData
): Promise<OrderStatusActionState> {
  // SECURITY: authorize before any DB writes.
  try {
    await requireAdmin()
  } catch (err) {
    return { error: errorMessage(err) }
  }

  const orderNumber = formData.get("orderNumber")
  const status = formData.get("status")

  if (typeof orderNumber !== "string" || !orderNumber) {
    return { error: "Order number is required." }
  }

  // Only admin-settable fulfillment statuses are accepted. PENDING and
  // REFUNDED are excluded so an admin UI action can never falsely mark an
  // order as paid or refunded — payment state stays driven by webhooks.
  const normalized = normalizeOrderStatus(status)
  if (!normalized) {
    return { error: "Invalid order status." }
  }

  try {
    await updateOrderStatus(orderNumber, normalized)
    revalidatePath("/dashboard/orders")
    revalidatePath(`/dashboard/orders/${orderNumber}`)
    return {}
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update order status.",
    }
  }
}
