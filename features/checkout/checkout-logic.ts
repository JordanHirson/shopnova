/** ShopNova - Checkout business logic (pure functions).
 *
 * This module is intentionally dependency-free so it can be unit tested
 * with Node's native test runner and reused by server actions and the
 * order service. All money math is done in integer cents to avoid
 * floating-point drift.
 *
 * PRICE RULE:
 * The client is NEVER authoritative for price. These functions operate on
 * authoritative values re-read from PostgreSQL at order-creation time.
 */
import type { CartItem } from "../../types/cart"

// ── Business rules ────────────────────────────

/** South African VAT rate (guidebook critical test case). */
export const VAT_RATE = 0.15

/** Free shipping threshold (subtotal in currency units). */
export const FREE_SHIPPING_THRESHOLD = 50

/** Flat shipping rate below the free threshold (currency units). */
export const FLAT_SHIPPING_RATE = 5

// ── Money helpers ─────────────────────────────

function toCents(amount: number): number {
  return Math.round(amount * 100)
}

function fromCents(cents: number): number {
  return cents / 100
}

// ── Calculations ──────────────────────────────

/** VAT (15%) on a subtotal, computed in cents. */
export function calculateVat(subtotal: number): number {
  return fromCents(Math.round(toCents(subtotal) * VAT_RATE))
}

/**
 * Deterministic MVP shipping calculation.
 * - Empty/zero subtotal => 0
 * - Subtotal at or above the free threshold => 0
 * - Otherwise => flat rate
 *
 * Kept separate from the UI so a courier integration can replace it later.
 */
export function calculateShipping(subtotal: number): number {
  if (subtotal <= 0) return 0
  if (subtotal >= FREE_SHIPPING_THRESHOLD) return 0
  return FLAT_SHIPPING_RATE
}

/** Order subtotal (sum of line totals) computed in cents. */
export function calculateOrderSubtotal(items: CartItem[]): number {
  const totalCents = items.reduce(
    (sum, item) => sum + toCents(item.lineTotal),
    0
  )
  return fromCents(totalCents)
}

/** Order total = subtotal + shipping + VAT, computed in cents. */
export function calculateOrderTotal(
  subtotal: number,
  shipping: number,
  vat: number
): number {
  return fromCents(toCents(subtotal) + toCents(shipping) + toCents(vat))
}

// ── Validation ────────────────────────────────

/**
 * Validates requested quantities against available inventory.
 * Returns an error message, or null when all quantities are valid.
 */
export function validateOrderQuantities(
  items: Array<{ productId: string; quantity: number }>,
  availableByProduct: Map<string, number>
): string | null {
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return "Quantity must be at least 1."
    }

    const available = availableByProduct.get(item.productId)
    if (available === undefined) {
      return "A product in your cart is no longer available."
    }

    if (item.quantity > available) {
      return `Only ${available} available in stock.`
    }
  }

  return null
}

// ── Order number ──────────────────────────────

/**
 * Generates a unique, customer-facing order number.
 *
 * Format: SN-YYYYMMDD-XXXXXX (e.g. SN-20260818-000123).
 * Uses a date prefix plus a random suffix so it is human-readable and
 * does not expose the internal database id.
 */
export function generateOrderNumber(date = new Date()): string {
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "")
  const suffix = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0")
  return `SN-${yyyymmdd}-${suffix}`
}