/**
 * ShopNova - AI Fulfilment server action (Demo Step 5).
 *
 * One-click "AI Fulfill & Book Courier": re-runs the courier recommendation
 * through the existing shipping abstraction (Bob Go when configured, with a
 * deterministic simulated fallback), advances the order to PROCESSING, and
 * generates a simulated tracking number + shipping label for the modal.
 *
 * SECURITY:
 * - Authorizes via `requireAdmin()` before any DB read or write — a customer
 *   calling this action directly is rejected.
 * - Re-loads the order server-side from the persisted record; no client
 *   input is trusted for the quote or the status transition.
 * - Payment state is never touched (mirrors `updateOrderStatusAction`).
 */
"use server"

import { revalidatePath } from "next/cache"

import { getOrderForAdmin, updateOrderStatus } from "@/lib/db"
import {
  AdminRequiredError,
  UnauthenticatedError,
  requireAdmin,
} from "@/lib/auth/admin"
import {
  generateTrackingNumber,
  recommendCourier,
  type TriageOrder,
} from "@/features/admin/ai-triage"

/** Shape returned to the client on success. */
export interface AiFulfillSuccess {
  ok: true
  trackingNumber: string
  courier: string
  rate: number
  currency: string
  estimateHours: number
  simulated: boolean
  status: string
}

/** Shape returned to the client on failure. */
export interface AiFulfillFailure {
  ok: false
  error: string
}

export type AiFulfillResult = AiFulfillSuccess | AiFulfillFailure

function errorMessage(err: unknown): string {
  if (err instanceof UnauthenticatedError) return err.message
  if (err instanceof AdminRequiredError) return err.message
  return err instanceof Error ? err.message : "Something went wrong."
}

/**
 * Maps a persisted order (with product physical data) into the triage input
 * shape. Keeps the action decoupled from the Prisma generated type.
 */
function toTriageOrder(order: Awaited<ReturnType<typeof getOrderForAdmin>>): TriageOrder | null {
  if (!order) return null
  const isPaid = order.payments.some((p) => p.status === "SUCCEEDED")
  return {
    orderNumber: order.orderNumber,
    currency: order.currency,
    subtotal: Number(order.subtotal),
    shippingCity: order.shippingCity,
    shippingProvince: order.shippingProvince,
    shippingPostalCode: order.shippingPostalCode,
    shippingCountry: order.shippingCountry,
    shippingAddress: order.shippingAddress,
    isPaid,
    items: order.items.map((item) => ({
      quantity: item.quantity,
      product: {
        weightGrams: item.product.weightGrams,
        lengthCm: item.product.lengthCm,
        widthCm: item.product.widthCm,
        heightCm: item.product.heightCm,
        inventory: item.product.inventory,
      },
    })),
  }
}

/**
 * Books the cheapest courier for an order and advances it to PROCESSING.
 * Returns a simulated tracking number + label details for the modal. The
 * quote flows through the same defensive shipping registry as checkout.
 */
export async function aiFulfillOrderAction(
  orderNumber: string
): Promise<AiFulfillResult> {
  // SECURITY: authorize before any DB read or write.
  try {
    await requireAdmin()
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }

  if (!orderNumber || typeof orderNumber !== "string") {
    return { ok: false, error: "Order number is required." }
  }

  const persisted = await getOrderForAdmin(orderNumber)
  const triageOrder = toTriageOrder(persisted)
  if (!persisted || !triageOrder) {
    return { ok: false, error: "Order not found." }
  }

  // Re-run the courier recommendation through the live registry (Bob Go when
  // configured) with a deterministic simulated fallback for the demo.
  const recommendation = await recommendCourier(triageOrder)

  // Advance the order to PROCESSING (courier booked, awaiting dispatch).
  // Payment state is intentionally not touched.
  try {
    await updateOrderStatus(orderNumber, "PROCESSING")
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update order status.",
    }
  }

  const trackingNumber = generateTrackingNumber(orderNumber)

  revalidatePath("/dashboard/orders")
  revalidatePath(`/dashboard/orders/${orderNumber}`)

  return {
    ok: true,
    trackingNumber,
    courier: recommendation.label,
    rate: recommendation.rate,
    currency: recommendation.currency,
    estimateHours: recommendation.estimateHours,
    simulated: recommendation.simulated,
    status: "PROCESSING",
  }
}
