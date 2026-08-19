/**
 * ShopNova - Checkout server actions.
 *
 * The client is NEVER trusted for price, inventory, subtotal, tax,
 * shipping, or total. All authoritative values are re-read from
 * PostgreSQL at order-creation time inside a single transaction.
 */
"use server"

import { revalidatePath } from "next/cache"
import { createOrder, getOrderByOrderNumber } from "@/lib/db"
import { checkoutSchema, type CheckoutFormValues } from "@/lib/validations/checkout"
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

/** Result of placing an order. */
export interface PlaceOrderResult {
  orderNumber?: string
  error?: string
}

/**
 * Validates checkout details, creates the order inside a transaction,
 * and clears the cart only after the order succeeds.
 */
export async function placeOrderAction(
  input: CheckoutFormValues
): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid checkout details.",
    }
  }

  const shopperId = await getShopperId()
  const cart = await cartStore.getCart(shopperId)
  if (!cart || cart.items.length === 0) {
    return { error: "Your cart is empty." }
  }

  try {
    const result = await createOrder(cart.items, parsed.data)

    // Clear the cart only after the order transaction succeeds.
    await cartStore.deleteCart(shopperId)
    revalidatePath("/", "layout")

    return { orderNumber: result.orderNumber }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to place the order.",
    }
  }
}

/** Returns an order by its order number for the confirmation page. */
export async function getOrderAction(orderNumber: string) {
  return getOrderByOrderNumber(orderNumber)
}