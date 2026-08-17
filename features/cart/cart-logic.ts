/** ShopNova - Cart business logic (pure functions).
 *
 * This module is intentionally dependency-free so it can be unit tested
 * with Node's native test runner and reused by any cart store (Memory,
 * Redis, ...). All money math is done in integer cents to avoid
 * floating-point drift.
 *
 * PRICE RULE:
 * The client is NOT authoritative for price. Cart lines hold a display
 * snapshot (unitPrice) captured from PostgreSQL at add-to-cart time.
 * Checkout MUST re-read authoritative prices from the database.
 */
import type { Cart, CartItem, CartItemData } from "../../types/cart"

const MAX_QUANTITY = 99
const MIN_QUANTITY = 1

function toCents(amount: number): number {
  return Math.round(amount * 100)
}

function fromCents(cents: number): number {
  return cents / 100
}

/** Result of a pure cart mutation. */
export interface CartMutationResult {
  cart: Cart
  error?: string
}

/** Creates a new empty cart. */
export function createEmptyCart(): Cart {
  return { items: [], updatedAt: new Date(0).toISOString() }
}

/** Line total for a unit price and quantity, computed in cents. */
export function calculateLineTotal(
  unitPrice: number,
  quantity: number
): number {
  return fromCents(toCents(unitPrice) * quantity)
}

/** Subtotal (sum of line totals) computed in cents. */
export function getCartSubtotal(cart: Cart): number {
  const totalCents = cart.items.reduce(
    (sum, item) => sum + toCents(item.lineTotal),
    0
  )
  return fromCents(totalCents)
}

/** Total number of units across all cart lines. */
export function getCartItemCount(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0)
}

function withTimestamp(items: CartItem[]): Cart {
  return { items, updatedAt: new Date().toISOString() }
}

function toLine(item: CartItemData, quantity: number): CartItem {
  return {
    ...item,
    quantity,
    lineTotal: calculateLineTotal(item.unitPrice, quantity),
  }
}

/**
 * Resolves a requested quantity against the available inventory.
 * - quantity < 1 => error, fallback 1
 * - inventoryLimit < 1 => out of stock
 * - quantity > inventoryLimit => capped to the limit with an error
 */
function resolveQuantity(
  quantity: number,
  inventoryLimit?: number
): { quantity: number; error?: string } {
  if (!Number.isInteger(quantity) || quantity < MIN_QUANTITY) {
    return { quantity: MIN_QUANTITY, error: "Quantity must be at least 1." }
  }

  if (inventoryLimit !== undefined) {
    if (inventoryLimit < MIN_QUANTITY) {
      return { quantity: 0, error: "This item is currently out of stock." }
    }
    if (quantity > inventoryLimit) {
      return {
        quantity: inventoryLimit,
        error: `Only ${inventoryLimit} available in stock.`,
      }
    }
  }

  if (quantity > MAX_QUANTITY) {
    return {
      quantity: MAX_QUANTITY,
      error: `Maximum quantity per item is ${MAX_QUANTITY}.`,
    }
  }

  return { quantity }
}

/**
 * Adds a product to the cart. Adding the same product again increases the
 * quantity of the existing line instead of creating a duplicate.
 */
export function addItemToCart(
  cart: Cart,
  item: CartItemData,
  inventoryLimit?: number
): CartMutationResult {
  const resolved = resolveQuantity(item.quantity, inventoryLimit)

  if (resolved.quantity < 1) {
    return { cart, error: resolved.error }
  }

  const existingIndex = cart.items.findIndex(
    (line) => line.productId === item.productId
  )

  if (existingIndex === -1) {
    return {
      cart: withTimestamp([...cart.items, toLine(item, resolved.quantity)]),
      error: resolved.error,
    }
  }

  const existing = cart.items[existingIndex]
  const requested = existing.quantity + (resolved.error ? 0 : resolved.quantity)

  if (inventoryLimit !== undefined && requested > inventoryLimit) {
    const items = cart.items.map((line, index) =>
      index === existingIndex ? toLine(line, inventoryLimit) : line
    )
    return {
      cart: withTimestamp(items),
      error: `Only ${inventoryLimit} available in stock.`,
    }
  }

  if (requested > MAX_QUANTITY) {
    const items = cart.items.map((line, index) =>
      index === existingIndex ? toLine(line, MAX_QUANTITY) : line
    )
    return {
      cart: withTimestamp(items),
      error: `Maximum quantity per item is ${MAX_QUANTITY}.`,
    }
  }

  const items = cart.items.map((line, index) =>
    index === existingIndex ? toLine(line, requested) : line
  )
  return { cart: withTimestamp(items), error: resolved.error }
}

/**
 * Sets the quantity of a cart line to an exact value.
 * Quantity can never drop below 1 (use removeCartItem to remove a line).
 */
export function updateCartItemQuantity(
  cart: Cart,
  productId: string,
  quantity: number,
  inventoryLimit?: number
): CartMutationResult {
  const existingIndex = cart.items.findIndex(
    (line) => line.productId === productId
  )

  if (existingIndex === -1) {
    return { cart, error: "Item is not in the cart." }
  }

  // Setting quantity to 0 or negative removes the line so the cart
  // never holds a zero/negative quantity item.
  if (!Number.isInteger(quantity) || quantity < MIN_QUANTITY) {
    const items = cart.items.filter((_, index) => index !== existingIndex)
    return {
      cart: withTimestamp(items),
      error: "Quantity must be at least 1.",
    }
  }

  const resolved = resolveQuantity(quantity, inventoryLimit)

  if (resolved.quantity < 1) {
    const items = cart.items.filter((_, index) => index !== existingIndex)
    return { cart: withTimestamp(items), error: resolved.error }
  }

  const items = cart.items.map((line, index) =>
    index === existingIndex ? toLine(line, resolved.quantity) : line
  )
  return { cart: withTimestamp(items), error: resolved.error }
}

/** Removes a single line from the cart. */
export function removeCartItem(cart: Cart, productId: string): Cart {
  return withTimestamp(
    cart.items.filter((line) => line.productId !== productId)
  )
}

/** Clears the cart. */
export function clearCart(): Cart {
  return createEmptyCart()
}