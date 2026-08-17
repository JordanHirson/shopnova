/** ShopNova - Cart Types
 * Shared type definitions for the cart domain.
 *
 * PRICE RULE:
 * The client is NOT authoritative for price. Cart lines store a display
 * snapshot (unitPrice) captured from PostgreSQL at add-to-cart time. The
 * checkout stage MUST re-read authoritative product prices from the
 * database before creating an order.
 */

/** Minimal data needed to render a cart line (not the full Product record). */
export interface CartItemData {
  productId: string
  name: string
  slug: string
  imageUrl: string | null
  unitPrice: number
  quantity: number
}

/** A persisted cart line, including the derived line total. */
export interface CartItem extends CartItemData {
  lineTotal: number
}

/** The persisted cart shape returned by the cart store. */
export interface Cart {
  items: CartItem[]
  updatedAt: string
}

/** Result returned by cart server actions. */
export interface CartActionResult {
  cart: Cart
  error?: string
}