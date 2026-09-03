/**
 * ShopNova - Authoritative checkout line loader.
 *
 * Shared by the checkout summary and shipping-quote server actions so the
 * subtotal/item count is computed once, server-side, from PostgreSQL. The
 * client is never authoritative for price: cart line prices are re-read
 * from the database here, never from the cart snapshot.
 *
 * This module is NOT a "use server" module (it exports a plain async helper,
 * not a server action) so it can be imported by multiple server actions
 * without each export becoming an action.
 */
import "server-only"

import { cartStore } from "@/features/cart/cart-store"
import { getShopperId } from "@/features/cart/session"
import { getCartProduct } from "@/lib/db/cart"

/** A single authoritative checkout line re-read from PostgreSQL. */
export interface AuthoritativeCheckoutLine {
  productId: string
  name: string
  slug: string
  imageUrl: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
  // Physical characteristics (nullable) used to build accurate shipping
  // parcels for live courier quotes (e.g. Bob Go). Null/zero → fallback.
  weightGrams: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
}

/** Authoritative checkout lines + derived subtotal and item count. */
export interface AuthoritativeCheckoutLines {
  items: AuthoritativeCheckoutLine[]
  subtotal: number
  itemCount: number
}

/**
 * Loads the current shopper's cart and re-reads authoritative product
 * prices from PostgreSQL. Returns null when the cart is empty or every line
 * is no longer available. Archived products are excluded by `getCartProduct`.
 */
export async function loadAuthoritativeCheckoutLines(): Promise<AuthoritativeCheckoutLines | null> {
  const shopperId = await getShopperId()
  const cart = await cartStore.getCart(shopperId)
  if (!cart || cart.items.length === 0) return null

  const items: AuthoritativeCheckoutLine[] = []
  let subtotal = 0
  let itemCount = 0

  for (const line of cart.items) {
    const product = await getCartProduct(line.productId)
    if (!product) continue

    const unitPrice = product.price
    const lineTotal = Math.round(unitPrice * 100 * line.quantity) / 100
    subtotal += lineTotal
    itemCount += line.quantity

    items.push({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: product.imageUrl,
      quantity: line.quantity,
      unitPrice,
      lineTotal,
      weightGrams: product.weightGrams,
      lengthCm: product.lengthCm,
      widthCm: product.widthCm,
      heightCm: product.heightCm,
    })
  }

  if (items.length === 0) return null
  return { items, subtotal, itemCount }
}
