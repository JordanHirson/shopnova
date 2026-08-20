/**
 * ShopNova - Customer account logic unit tests.
 *
 * Run with: node --test --experimental-strip-types features/account/account-logic.test.ts
 *
 * Covers the security-critical authorization helpers and the
 * Clerk/Customer association behavior that can be verified with pure
 * functions (no DB, no Clerk credentials):
 *   - A signed-in shopper's clerk user id is extracted from the shopper id.
 *   - Anonymous shoppers never resolve to a clerk user id.
 *   - An order is only "owned" when its customer id matches.
 *   - Guest orders (null customer) can never be served to a signed-in customer.
 *   - assertOrderOwnedByCustomer throws for foreign / missing orders.
 *   - Display name fallbacks behave sensibly.
 */
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  ANON_SHOPPER_PREFIX,
  CLERK_SHOPPER_PREFIX,
  OrderNotOwnedError,
  assertOrderOwnedByCustomer,
  buildDisplayName,
  clerkUserIdFromShopperId,
  isOrderOwnedByCustomer,
} from "./account-logic.ts"

// ── Clerk / Customer association ──────────────

test("clerkUserIdFromShopperId extracts the id from a signed-in shopper id", () => {
  assert.equal(clerkUserIdFromShopperId(`${CLERK_SHOPPER_PREFIX}abc123`), "abc123")
  assert.equal(clerkUserIdFromShopperId("user:user_2XYZ_nope"), "user_2XYZ_nope")
})

test("clerkUserIdFromShopperId returns null for anonymous shoppers", () => {
  assert.equal(clerkUserIdFromShopperId(`${ANON_SHOPPER_PREFIX}550e8400-...`), null)
  assert.equal(clerkUserIdFromShopperId("anon:abc"), null)
})

test("clerkUserIdFromShopperId returns null for an empty/unknown shopper id", () => {
  assert.equal(clerkUserIdFromShopperId("user:"), null)
  assert.equal(clerkUserIdFromShopperId("something-else"), null)
  assert.equal(clerkUserIdFromShopperId(""), null)
})

// ── Order ownership (authorization boundary) ──

test("isOrderOwnedByCustomer is true when the order's customer id matches", () => {
  assert.equal(
    isOrderOwnedByCustomer({ customerId: "c1" }, "c1"),
    true
  )
})

test("isOrderOwnedByCustomer is false when the order belongs to another customer", () => {
  assert.equal(
    isOrderOwnedByCustomer({ customerId: "c1" }, "c2"),
    false
  )
})

test("isOrderOwnedByCustomer is false for a guest order (null customer)", () => {
  // A signed-in customer must never be served an order that has no owner.
  assert.equal(isOrderOwnedByCustomer({ customerId: null }, "c1"), false)
})

test("isOrderOwnedByCustomer is false when the customer id is missing", () => {
  assert.equal(isOrderOwnedByCustomer({ customerId: "c1" }, null), false)
  assert.equal(isOrderOwnedByCustomer({ customerId: "c1" }, undefined), false)
})

test("isOrderOwnedByCustomer is false when the order is missing (not found)", () => {
  assert.equal(isOrderOwnedByCustomer(null, "c1"), false)
  assert.equal(isOrderOwnedByCustomer(undefined, "c1"), false)
})

test("assertOrderOwnedByCustomer throws OrderNotOwnedError for a foreign order", () => {
  assert.throws(
    () => assertOrderOwnedByCustomer({ customerId: "c1" }, "c2"),
    (err) => err instanceof OrderNotOwnedError
  )
})

test("assertOrderOwnedByCustomer throws for a missing order", () => {
  assert.throws(
    () => assertOrderOwnedByCustomer(null, "c1"),
    (err) => err instanceof OrderNotOwnedError
  )
})

test("assertOrderOwnedByCustomer does not throw for the owner", () => {
  assert.doesNotThrow(() =>
    assertOrderOwnedByCustomer({ customerId: "c1" }, "c1")
  )
})

// ── Display name fallbacks ─────────────────────

test("buildDisplayName combines first and last name", () => {
  assert.equal(buildDisplayName("Ada", "Lovelace"), "Ada Lovelace")
})

test("buildDisplayName trims and handles a single name", () => {
  assert.equal(buildDisplayName("Ada", null), "Ada")
  assert.equal(buildDisplayName(null, "Lovelace"), "Lovelace")
  assert.equal(buildDisplayName("  Ada  ", "  Lovelace  "), "Ada Lovelace")
})

test("buildDisplayName falls back to the email local-part when no name is set", () => {
  assert.equal(buildDisplayName(null, null, "ada@example.com"), "ada")
})

test("buildDisplayName falls back to a default when nothing is available", () => {
  assert.equal(buildDisplayName(null, null, null), "ShopNova Customer")
  assert.equal(buildDisplayName("", "", "not-an-email"), "ShopNova Customer")
})
