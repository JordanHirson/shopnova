/**
 * ShopNova - Customer account pure logic.
 *
 * Pure helpers for the customer-account security boundary. These are
 * intentionally side-effect free so they can be unit tested with Node's
 * native test runner without a database or Clerk credentials.
 *
 * Security model:
 *   - Clerk is the authentication source of truth.
 *   - A signed-in shopper's cart/checkout shopperId is `user:<clerkUserId>`.
 *   - A Customer row is linked to a Clerk user via the nullable, unique
 *     `clerkUserId` column (set during checkout when the shopper is signed in).
 *   - Order access is authorized server-side by scoping every order query
 *     to the authenticated customer's id. The browser is never trusted.
 */

/** Prefix used for signed-in shopper ids (see features/cart/session.ts). */
export const CLERK_SHOPPER_PREFIX = "user:"

/** Prefix used for anonymous shopper ids (see features/cart/session.ts). */
export const ANON_SHOPPER_PREFIX = "anon:"

/**
 * Extracts the Clerk user id from a shopper id, or null when the shopper
 * was anonymous (`anon:<uuid>`). Used to associate a checkout Customer
 * with the authenticated Clerk user.
 */
export function clerkUserIdFromShopperId(shopperId: string): string | null {
  if (shopperId.startsWith(CLERK_SHOPPER_PREFIX)) {
    const id = shopperId.slice(CLERK_SHOPPER_PREFIX.length)
    return id.length > 0 ? id : null
  }
  return null
}

/** A minimal order shape carrying the owning customer id (for authorization). */
export interface OwnedOrder {
  customerId: string | null
}

/**
 * Returns true when the order belongs to the given customer.
 * Treats a null customer id as "not owned" so guest orders can never be
 * served through an authenticated customer's account.
 */
export function isOrderOwnedByCustomer(
  order: OwnedOrder | null | undefined,
  customerId: string | null | undefined
): boolean {
  if (!order || !order.customerId || !customerId) return false
  return order.customerId === customerId
}

/**
 * Throws when the order does not belong to the given customer, or when
 * either side is missing. Used as a defensive double-check after a query
 * that is already scoped to the customer.
 */
export function assertOrderOwnedByCustomer(
  order: OwnedOrder | null | undefined,
  customerId: string | null | undefined
): void {
  if (!isOrderOwnedByCustomer(order, customerId)) {
    throw new OrderNotOwnedError()
  }
}

/** Raised when an authenticated customer tries to access another customer's order. */
export class OrderNotOwnedError extends Error {
  constructor() {
    super("You do not have access to this order.")
    this.name = "OrderNotOwnedError"
  }
}

/**
 * Builds a display name from Clerk-provided name parts, falling back to
 * the email local-part when no name is available.
 */
export function buildDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const first = (firstName ?? "").trim()
  const last = (lastName ?? "").trim()
  if (first || last) return `${first} ${last}`.trim()
  if (email && email.includes("@")) return email.split("@")[0]
  return "ShopNova Customer"
}
