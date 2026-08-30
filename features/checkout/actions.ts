/**
 * ShopNova - Checkout server actions.
 *
 * The client is NEVER trusted for price, inventory, subtotal, tax,
 * shipping, or total. All authoritative values are re-read from
 * PostgreSQL. Order creation happens only after a server-verified
 * payment notification (see features/payment/actions.ts and
 * lib/db/payments.ts); this module exposes the authoritative checkout
 * summary (with a server-obtained shipping quote) and order lookup.
 *
 * SHIPPING:
 * - `getCheckoutSummaryAction` accepts an optional destination. When the
 *   destination is complete, shipping is obtained through the server-side
 *   shipping-provider abstraction (authoritative quote). When no
 *   destination is supplied (e.g. before the address form is filled), the
 *   deterministic MVP estimate is shown so the summary always renders.
 * - The displayed summary is an estimate until the authoritative quote is
 *   taken at intent creation (`createCheckoutIntent`). The client never
 *   supplies a shipping rate.
 */
"use server"

import { getOrderByOrderNumber } from "@/lib/db"
import { calculateOrderTotal, calculateShipping, calculateVat } from "./checkout-logic"
import { loadAuthoritativeCheckoutLines } from "./checkout-lines"
import {
  buildQuoteRequest,
  isShippingDestinationComplete,
  shippingAddressFromDestination,
  type CheckoutDestination,
} from "@/features/shipping/shipping-logic"
import {
  getAuthoritativeShippingQuote,
  getShippingOrigin,
} from "@/features/shipping/provider-registry"

/** Authoritative checkout summary returned to the client. */
export interface CheckoutSummary {
  items: Array<{
    productId: string
    name: string
    slug: string
    imageUrl: string | null
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  shipping: number
  /** Shipping provider id (e.g. "mvp") when a quote was obtained, else null. */
  shippingProvider: string | null
  /** Shipping method name when a quote was obtained, else null. */
  shippingMethod: string | null
  vat: number
  total: number
}

/**
 * Returns the authoritative checkout summary for the current shopper's
 * cart. Re-reads prices and inventory from PostgreSQL so the displayed
 * totals always match what will be charged at order creation.
 *
 * When a complete `destination` is supplied, shipping is obtained through
 * the server-side shipping-provider abstraction (the authoritative quote
 * the order will use). When omitted, the deterministic MVP estimate is
 * shown so the summary renders before the address is filled.
 */
export async function getCheckoutSummaryAction(
  destination?: Partial<CheckoutDestination>
): Promise<CheckoutSummary | null> {
  const lines = await loadAuthoritativeCheckoutLines()
  if (!lines) return null

  const currency = "ZAR"
  let shipping: number
  let shippingProvider: string | null
  let shippingMethod: string | null

  if (destination && isShippingDestinationComplete(destination)) {
    // Authoritative quote through the provider abstraction.
    const quote = await getAuthoritativeShippingQuote(
      buildQuoteRequest({
        origin: getShippingOrigin(),
        destination: shippingAddressFromDestination(destination),
        subtotal: lines.subtotal,
        currency,
        itemCount: lines.itemCount,
      })
    )
    shipping = quote.rate
    shippingProvider = quote.provider
    shippingMethod = quote.method
  } else {
    // Deterministic MVP estimate (display only until the address is filled).
    shipping = calculateShipping(lines.subtotal)
    shippingProvider = null
    shippingMethod = null
  }

  const vat = calculateVat(lines.subtotal)
  const total = calculateOrderTotal(lines.subtotal, shipping, vat)

  return {
    items: lines.items,
    subtotal: lines.subtotal,
    shipping,
    shippingProvider,
    shippingMethod,
    vat,
    total,
  }
}

/** Returns an order by its order number for the confirmation page. */
export async function getOrderAction(orderNumber: string) {
  return getOrderByOrderNumber(orderNumber)
}
