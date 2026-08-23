/**
 * ShopNova - Admin authorization logic unit tests.
 *
 * Run with: node --test --experimental-strip-types features/admin/admin-logic.test.ts
 *
 * Covers the security-critical admin authorization helpers and order-status
 * rules that can be verified with pure functions (no DB, no Clerk credentials):
 *   - Role matching is exact and case-sensitive.
 *   - Metadata role extraction tolerates missing/invalid values.
 *   - assertAdminRole throws AdminRequiredError for non-admins.
 *   - Admin-settable order statuses exclude PENDING and REFUNDED (payment
 *     security: an admin UI action must never mark an order paid/refunded).
 *   - normalizeOrderStatus rejects invalid inputs.
 */
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  ADMIN_ORDER_STATUSES,
  ADMIN_ROLE,
  AdminRequiredError,
  assertAdminRole,
  isAdminOrderStatus,
  isAdminRole,
  normalizeOrderStatus,
  roleFromMetadata,
} from "./admin-logic.ts"

// ── Role matching ─────────────────────────────

test("isAdminRole is true only for the exact admin role", () => {
  assert.equal(isAdminRole(ADMIN_ROLE), true)
  assert.equal(isAdminRole("admin"), true)
})

test("isAdminRole is false for non-admin roles and wrong types", () => {
  assert.equal(isAdminRole("customer"), false)
  assert.equal(isAdminRole("ADMIN"), false) // case-sensitive
  assert.equal(isAdminRole("admin "), false) // no whitespace tolerance
  assert.equal(isAdminRole(""), false)
  assert.equal(isAdminRole(null), false)
  assert.equal(isAdminRole(undefined), false)
  assert.equal(isAdminRole(0), false)
  assert.equal(isAdminRole({ role: "admin" }), false)
})

// ── Metadata extraction ───────────────────────

test("roleFromMetadata extracts a string role", () => {
  assert.equal(roleFromMetadata({ role: "admin" }), "admin")
  assert.equal(roleFromMetadata({ role: "customer" }), "customer")
})

test("roleFromMetadata returns null when the role is missing or non-string", () => {
  assert.equal(roleFromMetadata({}), null)
  assert.equal(roleFromMetadata({ other: "x" }), null)
  assert.equal(roleFromMetadata({ role: 123 }), null)
  assert.equal(roleFromMetadata({ role: null }), null)
  assert.equal(roleFromMetadata(null), null)
  assert.equal(roleFromMetadata(undefined), null)
})

// ── assertAdminRole ───────────────────────────

test("assertAdminRole does not throw for an admin role", () => {
  assert.doesNotThrow(() => assertAdminRole("admin"))
})

test("assertAdminRole throws AdminRequiredError for a non-admin role", () => {
  assert.throws(
    () => assertAdminRole("customer"),
    (err) => err instanceof AdminRequiredError
  )
})

test("assertAdminRole throws AdminRequiredError for missing/invalid roles", () => {
  assert.throws(
    () => assertAdminRole(null),
    (err) => err instanceof AdminRequiredError
  )
  assert.throws(
    () => assertAdminRole(undefined),
    (err) => err instanceof AdminRequiredError
  )
  assert.throws(
    () => assertAdminRole("ADMIN"),
    (err) => err instanceof AdminRequiredError
  )
})

// ── Order status rules ────────────────────────

test("isAdminOrderStatus accepts the admin-settable fulfillment statuses", () => {
  for (const status of ADMIN_ORDER_STATUSES) {
    assert.equal(isAdminOrderStatus(status), true, `${status} should be allowed`)
  }
})

test("isAdminOrderStatus rejects PENDING (pre-payment state)", () => {
  // An admin must not be able to push an order back to the pre-payment state.
  assert.equal(isAdminOrderStatus("PENDING"), false)
})

test("isAdminOrderStatus rejects REFUNDED (must come from payment/webhook logic)", () => {
  // Payment security: refunds are driven by payment records, not admin UI.
  assert.equal(isAdminOrderStatus("REFUNDED"), false)
})

test("isAdminOrderStatus rejects invalid and wrong-type inputs", () => {
  assert.equal(isAdminOrderStatus("confirmed"), false) // case-sensitive
  assert.equal(isAdminOrderStatus(""), false)
  assert.equal(isAdminOrderStatus(null), false)
  assert.equal(isAdminOrderStatus(undefined), false)
  assert.equal(isAdminOrderStatus(123), false)
  assert.equal(isAdminOrderStatus("SHIPPED "), false)
})

test("normalizeOrderStatus returns the status when valid, null otherwise", () => {
  assert.equal(normalizeOrderStatus("SHIPPED"), "SHIPPED")
  assert.equal(normalizeOrderStatus("DELIVERED"), "DELIVERED")
  assert.equal(normalizeOrderStatus("CANCELLED"), "CANCELLED")
  assert.equal(normalizeOrderStatus("PENDING"), null)
  assert.equal(normalizeOrderStatus("REFUNDED"), null)
  assert.equal(normalizeOrderStatus("bogus"), null)
  assert.equal(normalizeOrderStatus(null), null)
  assert.equal(normalizeOrderStatus(undefined), null)
  assert.equal(normalizeOrderStatus(42), null)
})
