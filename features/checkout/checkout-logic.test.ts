/**
 * ShopNova - Checkout business logic unit tests.
 *
 * Run with: node --test --experimental-strip-types features/checkout/checkout-logic.test.ts
 *
 * The guidebook identifies VAT, shipping, order totals, quantity
 * validation, and insufficient inventory as critical test areas.
 */
import { test } from "node:test"
import assert from "node:assert/strict"

import type { CartItem } from "../../types/cart"
import {
  calculateOrderSubtotal,
  calculateOrderTotal,
  calculateShipping,
  calculateVat,
  generateOrderNumber,
  validateOrderQuantities,
  VAT_RATE,
} from "./checkout-logic.ts"

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: "p1",
    name: "Widget",
    slug: "widget",
    imageUrl: null,
    unitPrice: 10,
    quantity: 1,
    lineTotal: 10,
    ...overrides,
  }
}

// ── VAT ───────────────────────────────────────

test("VAT rate is 15%", () => {
  assert.equal(VAT_RATE, 0.15)
})

test("VAT on a whole subtotal", () => {
  assert.equal(calculateVat(100), 15)
})

test("VAT on a fractional subtotal rounds to cents", () => {
  assert.equal(calculateVat(19.99), 3.0)
  assert.equal(calculateVat(33.33), 5.0)
})

test("VAT on zero subtotal is zero", () => {
  assert.equal(calculateVat(0), 0)
})

// ── Shipping ──────────────────────────────────

test("shipping is free at or above the threshold", () => {
  assert.equal(calculateShipping(50), 0)
  assert.equal(calculateShipping(120.5), 0)
})

test("shipping is a flat rate below the threshold", () => {
  assert.equal(calculateShipping(10), 5)
  assert.equal(calculateShipping(49.99), 5)
})

test("shipping on an empty subtotal is zero", () => {
  assert.equal(calculateShipping(0), 0)
})

// ── Order subtotal ────────────────────────────

test("order subtotal sums line totals", () => {
  const items = [
    makeItem({ productId: "p1", unitPrice: 10, quantity: 2, lineTotal: 20 }),
    makeItem({ productId: "p2", unitPrice: 5, quantity: 3, lineTotal: 15 }),
  ]
  assert.equal(calculateOrderSubtotal(items), 35)
})

test("empty order subtotal is zero", () => {
  assert.equal(calculateOrderSubtotal([]), 0)
})

// ── Order total ───────────────────────────────

test("order total is subtotal + shipping + VAT", () => {
  const subtotal = 100
  const shipping = calculateShipping(subtotal)
  const vat = calculateVat(subtotal)
  assert.equal(calculateOrderTotal(subtotal, shipping, vat), 115)
})

test("order total uses cents math to avoid float drift", () => {
  const subtotal = 19.99
  const shipping = calculateShipping(subtotal)
  const vat = calculateVat(subtotal)
  const total = calculateOrderTotal(subtotal, shipping, vat)
  assert.equal(total, 27.99)
})

// ── Quantity validation ───────────────────────

test("valid quantities pass", () => {
  const available = new Map([
    ["p1", 10],
    ["p2", 5],
  ])
  const error = validateOrderQuantities(
    [
      { productId: "p1", quantity: 2 },
      { productId: "p2", quantity: 5 },
    ],
    available
  )
  assert.equal(error, null)
})

test("quantity cannot be zero or negative", () => {
  const available = new Map([["p1", 10]])
  assert.ok(validateOrderQuantities([{ productId: "p1", quantity: 0 }], available))
  assert.ok(validateOrderQuantities([{ productId: "p1", quantity: -1 }], available))
})

test("quantity cannot exceed available inventory", () => {
  const available = new Map([["p1", 3]])
  const error = validateOrderQuantities(
    [{ productId: "p1", quantity: 4 }],
    available
  )
  assert.ok(error)
  assert.match(error!, /Only 3 available/)
})

test("unknown product is rejected", () => {
  const available = new Map([["p1", 3]])
  const error = validateOrderQuantities(
    [{ productId: "missing", quantity: 1 }],
    available
  )
  assert.ok(error)
})

// ── Order number ──────────────────────────────

test("order number has the expected format", () => {
  const date = new Date("2026-08-18T12:00:00Z")
  const number = generateOrderNumber(date)
  assert.match(number, /^SN-\d{8}-\d{6}$/)
  assert.ok(number.startsWith("SN-20260818-"))
})

test("order numbers are unique across calls", () => {
  const seen = new Set<string>()
  for (let i = 0; i < 100; i++) {
    const number = generateOrderNumber()
    assert.ok(!seen.has(number))
    seen.add(number)
  }
})