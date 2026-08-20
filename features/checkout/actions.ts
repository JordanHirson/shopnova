/**
 * ShopNova - Checkout server actions.
 *
 * The client is NEVER trusted for price, inventory, subtotal, tax,
 * shipping, or total. All authoritative values are re-read from
 * PostgreSQL. Order creation now happens only after a server-verified
 * payment notification (see features/payment/actions.ts and
 * lib/db/payments.ts); this module exposes the authoritative checkout
 * summary and order lookup used by the UI.
 */
"use server"

import { getOrderByOrderNumber } from "@/lib/db"
import { cartStore } from "@/features/cart/cart-store"
import { getShopperId } from "@/features/cart/session"
import { getCartProduct } from "@/lib/db/cart"
import {
  calculateOrderTotal,
  calculateShipping,
  calculateVat,
} from "./checkout-logic"

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
  vat: number
  total: number
}

/**
 * Returns the authoritative checkout summary for the current shopper's
 * cart. Re-reads prices and inventory from PostgreSQL so the displayed
 * totals always match what will be charged at order creation.
 */
export async function getCheckoutSummaryAction(): Promise<CheckoutSummary | null> {
  const shopperId = await getShopperId()
  const cart = await cartStore.getCart(shopperId)
  if (!cart || cart.items.length === 0) return null

  const items: CheckoutSummary["items"] = []
  let subtotal = 0

  for (const line of cart.items) {
    const product = await getCartProduct(line.productId)
    if (!product) continue

    const unitPrice = product.price
    const lineTotal = Math.round(unitPrice * 100 * line.quantity) / 100
    subtotal += lineTotal

    items.push({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: product.imageUrl,
      quantity: line.quantity,
      unitPrice,
      lineTotal,
    })
  }

  if (items.length === 0) return null

  const shipping = calculateShipping(subtotal)
  const vat = calculateVat(subtotal)
  const total = calculateOrderTotal(subtotal, shipping, vat)

  return { items, subtotal, shipping, vat, total }
}

/** Returns an order by its order number for the confirmation page. */
export async function getOrderAction(orderNumber: string) {
  return getOrderByOrderNumber(orderNumber)
}