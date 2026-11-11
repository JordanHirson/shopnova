/**
 * ShopNova - Admin authorization pure logic.
 *
 * Pure, side-effect-free helpers for the admin security boundary. These are
 * intentionally framework-agnostic so they can be unit tested with Node's
 * native test runner without a database or Clerk credentials.
 *
 * Security model:
 *   - Clerk is the authentication source of truth (no second auth system).
 *   - An admin is a Clerk user whose `privateMetadata.role` is `"admin"`.
 *     `privateMetadata` is only readable server-side (via the Clerk Backend
 *     API / `currentUser()`), so a customer can never learn or forge admin
 *     status in the browser.
 *   - Every admin mutation and sensitive admin query MUST be authorized
 *     server-side via `requireAdmin()` (see lib/auth/admin.ts). The browser
 *     is never trusted — a normal customer calling an admin server action
 *     directly is rejected.
 */

/** The role value stored in Clerk `privateMetadata.role` for administrators. */
export const ADMIN_ROLE = "admin" as const;

/** Raised when a request is not authenticated (no Clerk user). */
export class UnauthenticatedError extends Error {
  constructor() {
    super("You must be signed in to access this area.")
    this.name = "UnauthenticatedError"
  }
}

/** Raised when an authenticated user is not an administrator. */
export class AdminRequiredError extends Error {
  constructor() {
    super("Administrator access is required.")
    this.name = "AdminRequiredError"
  }
}

/**
 * Returns true when the given role value represents an administrator.
 * The check is exact and case-sensitive to avoid accidental matches.
 */
export function isAdminRole(role: unknown): boolean {
  return role === ADMIN_ROLE
}

/**
 * Extracts a role value from a Clerk metadata object (public or private),
 * tolerating undefined/null/missing keys. Returns null when no role is set.
 */
export function roleFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata) return null
  const role = metadata.role
  return typeof role === "string" ? role : null
}

/**
 * Throws `AdminRequiredError` when the role is not an admin role.
 * Used as the core authorization assertion after the Clerk user is loaded.
 */
export function assertAdminRole(role: unknown): void {
  if (!isAdminRole(role)) {
    throw new AdminRequiredError()
  }
}

// ── Order status transitions ──────────────────

/** Order statuses an administrator is allowed to set manually. */
export const ADMIN_ORDER_STATUSES = [
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const

export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number]

/**
 * Allowed order fulfillment status transitions: current status → next statuses
 * an admin may move it to.
 *
 * CONFIRMED → PROCESSING or CANCELLED
 * PROCESSING → SHIPPED or CANCELLED
 * SHIPPED → DELIVERED
 * DELIVERED and CANCELLED are final (no outgoing transitions).
 *
 * Anything not listed is blocked — including staying in the same status — so
 * an order can only be cancelled once and can never be edited after it is
 * delivered or cancelled. PENDING and REFUNDED are not admin-settable
 * (payment state is driven by verified webhooks only), so they have no
 * outgoing admin transitions either.
 */
export const ORDER_TRANSITIONS: ReadonlyMap<
  AdminOrderStatus,
  readonly AdminOrderStatus[]
> = new Map([
  ["CONFIRMED", ["PROCESSING", "CANCELLED"]],
  ["PROCESSING", ["SHIPPED", "CANCELLED"]],
  ["SHIPPED", ["DELIVERED"]],
  ["DELIVERED", []],
  ["CANCELLED", []],
])

/**
 * Returns true when an admin may move an order from `from` to `to`.
 * Pure, side-effect-free — safe to unit test without a database.
 */
export function isAllowedOrderTransition(
  from: AdminOrderStatus,
  to: AdminOrderStatus
): boolean {
  return ORDER_TRANSITIONS.get(from)?.includes(to) ?? false
}

/**
 * Returns the statuses an admin may set next for an order in `currentStatus`.
 * Empty when the status is final (DELIVERED / CANCELLED). Drives the admin
 * status dropdown so only valid transitions are offered.
 */
export function getValidNextStatuses(
  currentStatus: AdminOrderStatus
): readonly AdminOrderStatus[] {
  return ORDER_TRANSITIONS.get(currentStatus) ?? []
}

/**
 * Returns true when no further admin status changes are allowed for `status`.
 */
export function isFinalOrderStatus(status: AdminOrderStatus): boolean {
  return getValidNextStatuses(status).length === 0
}

/**
 * Returns true when the given value is a status an admin may set.
 * Note: PENDING and REFUNDED are intentionally excluded — PENDING is the
 * pre-payment state and REFUNDED must be driven by payment/webhook logic,
 * not by an admin UI action. This keeps payment security intact.
 */
export function isAdminOrderStatus(value: unknown): value is AdminOrderStatus {
  return (
    typeof value === "string" &&
    (ADMIN_ORDER_STATUSES as readonly string[]).includes(value)
  )
}

/**
 * Normalizes an order status input. Returns the validated status or null
 * when the value is not an admin-settable status.
 */
export function normalizeOrderStatus(
  value: unknown
): AdminOrderStatus | null {
  return isAdminOrderStatus(value) ? value : null
}
