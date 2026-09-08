/**
 * ShopNova - Abandoned cart recovery feed (Demo Step 7).
 *
 * The MVP stores active carts in Redis (see features/cart/redis-cart-store)
 * and does not persist an `abandonedAt` column in PostgreSQL. To power the
 * real-time "Active Carts & Recovery" demo without a schema migration or a
 * new dependency, this helper derives a deterministic set of abandoned carts
 * from the store's REAL customers and products.
 *
 * This mirrors the codebase's established demo pattern: the AI fulfillment
 * step simulates a courier quote, and AI product generation has a mock
 * fallback. The abandonment feed is likewise a deterministic simulation
 * grounded in real catalog/customer data, so the demo always has something
 * to show while remaining store-scoped and admin-gated.
 */
import { prisma } from "./prisma"
import { getDefaultStoreId } from "./store"

/** A single line in an abandoned cart (snapshot of a real product). */
export interface AbandonedCartLine {
  productId: string
  productName: string
  slug: string
  quantity: number
  unitPrice: number
}

/** An abandoned cart shown in the recovery feed. */
export interface AbandonedCart {
  id: string
  cartNumber: number
  customerName: string
  customerEmail: string
  total: number
  currency: string
  /** Minutes since the cart was last touched by the shopper. */
  abandonedMinutesAgo: number
  items: AbandonedCartLine[]
}

/** Recovery email preview returned by the trigger action. */
export interface RecoveryEmailPreview {
  to: string
  subject: string
  customerName: string
  items: Array<{ name: string; quantity: number; price: number }>
  subtotal: number
  discountPct: number
  discountAmount: number
  total: number
  currency: string
  recoveryLink: string
  dispatchedAt: string
}

const CURRENCY = "ZAR"

/** Deterministic inactivity minutes — varied so the feed looks real. */
const INACTIVITY_MINUTES = [15, 8, 42, 3, 27, 11]

/** Base cart number so the feed shows friendly ids like "#302". */
const BASE_CART_NUMBER = 300

/**
 * Returns the abandoned-cart recovery feed for the default store, derived
 * deterministically from real customers and products. Returns an empty list
 * when the store has no customers or products to build carts from.
 */
export async function getAbandonedCarts(): Promise<AbandonedCart[]> {
  const storeId = await getDefaultStoreId()
  if (!storeId) return []

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: { storeId },
      take: 6,
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, firstName: true, lastName: true },
    }),
    prisma.product.findMany({
      where: { storeId, archived: false },
      take: 12,
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, slug: true, price: true },
    }),
  ])

  if (customers.length === 0 || products.length === 0) return []

  const carts: AbandonedCart[] = customers.map((customer, index) => {
    // Deterministic 1–3 items per cart, picked from the product pool.
    const itemCount = 1 + (index % 3)
    const lines: AbandonedCartLine[] = []
    let total = 0
    for (let i = 0; i < itemCount; i++) {
      const product = products[(index * 2 + i) % products.length]
      const quantity = 1 + ((index + i) % 2)
      const unitPrice = Number(product.price)
      lines.push({
        productId: product.id,
        productName: product.name,
        slug: product.slug,
        quantity,
        unitPrice,
      })
      total += unitPrice * quantity
    }

    const first = customer.firstName ?? ""
    const last = customer.lastName ?? ""
    const name = `${first} ${last}`.trim() || customer.email

    return {
      id: customer.id,
      cartNumber: BASE_CART_NUMBER + index + 1,
      customerName: name,
      customerEmail: customer.email,
      total,
      currency: CURRENCY,
      abandonedMinutesAgo: INACTIVITY_MINUTES[index % INACTIVITY_MINUTES.length],
      items: lines,
    }
  })

  // Most recently active (smallest inactivity) first.
  carts.sort((a, b) => a.abandonedMinutesAgo - b.abandonedMinutesAgo)
  return carts
}

/**
 * Builds the recovery email preview for a given cart id (customer id),
 * including a personalized subject, the abandoned items, and a 10% discount
 * recovery link. Returns null when the cart/customer cannot be found.
 */
export async function buildRecoveryEmail(
  cartId: string
): Promise<RecoveryEmailPreview | null> {
  const carts = await getAbandonedCarts()
  const cart = carts.find((c) => c.id === cartId)
  if (!cart) return null

  const discountPct = 10
  const discountAmount = Math.round(cart.total * (discountPct / 100) * 100) / 100
  const total = Math.round((cart.total - discountAmount) * 100) / 100

  const firstName = cart.customerName.split(" ")[0] || "there"
  const subject = `${firstName}, you left something behind — here's 10% off to complete your order`
  const recoveryLink = `https://shopnova.example/cart/recover?cart=${cart.id}&discount=RECOVER10`

  return {
    to: cart.customerEmail,
    subject,
    customerName: cart.customerName,
    items: cart.items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      price: item.unitPrice,
    })),
    subtotal: cart.total,
    discountPct,
    discountAmount,
    total,
    currency: cart.currency,
    recoveryLink,
    dispatchedAt: new Date().toISOString(),
  }
}
