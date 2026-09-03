/**
 * ShopNova - Product validation unit tests (post-MVP #5).
 *
 * Covers the Zod product schema's physical-characteristic fields
 * (weightGrams, lengthCm, widthCm, heightCm): valid values accepted,
 * omitted values accepted, zero accepted, negative values rejected,
 * non-integer values rejected. Run with the project test runner (`npm test`).
 */
import { test } from "node:test"
import assert from "node:assert/strict"

import { productSchema } from "./product.ts"

/** Minimal valid base values for the required, non-physical fields. */
function baseInput() {
  return {
    name: "Wireless Headphones",
    slug: "wireless-headphones",
    price: "19.99",
    categoryId: "cat-1",
  }
}

// ── Valid physical values ─────────────────────

test("productSchema accepts all four physical fields as positive integers", () => {
  const parsed = productSchema.safeParse({
    ...baseInput(),
    weightGrams: "750",
    lengthCm: "30",
    widthCm: "20",
    heightCm: "10",
  })
  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.equal(parsed.data.weightGrams, "750")
    assert.equal(parsed.data.lengthCm, "30")
    assert.equal(parsed.data.widthCm, "20")
    assert.equal(parsed.data.heightCm, "10")
  }
})

test("productSchema accepts when all physical fields are omitted", () => {
  const parsed = productSchema.safeParse(baseInput())
  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.equal(parsed.data.weightGrams, undefined)
    assert.equal(parsed.data.lengthCm, undefined)
    assert.equal(parsed.data.widthCm, undefined)
    assert.equal(parsed.data.heightCm, undefined)
  }
})

test("productSchema accepts null for physical fields (sent by the form actions)", () => {
  const parsed = productSchema.safeParse({
    ...baseInput(),
    weightGrams: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
  })
  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.equal(parsed.data.weightGrams, null)
    assert.equal(parsed.data.lengthCm, null)
  }
})

test("productSchema accepts empty strings for physical fields (treated as omitted)", () => {
  const parsed = productSchema.safeParse({
    ...baseInput(),
    weightGrams: "",
    lengthCm: "",
    widthCm: "",
    heightCm: "",
  })
  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.equal(parsed.data.weightGrams, "")
    assert.equal(parsed.data.lengthCm, "")
  }
})

test("productSchema accepts zero for all physical fields", () => {
  // Zero is permitted by validation; the shipping layer treats zero as
  // "not specified" and falls back to defaults (documented behaviour).
  const parsed = productSchema.safeParse({
    ...baseInput(),
    weightGrams: "0",
    lengthCm: "0",
    widthCm: "0",
    heightCm: "0",
  })
  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.equal(parsed.data.weightGrams, "0")
    assert.equal(parsed.data.lengthCm, "0")
  }
})

test("productSchema accepts partial physical data (weight but no dimensions)", () => {
  const parsed = productSchema.safeParse({
    ...baseInput(),
    weightGrams: "500",
  })
  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.equal(parsed.data.weightGrams, "500")
    assert.equal(parsed.data.lengthCm, undefined)
  }
})

// ── Negative values rejected ──────────────────

test("productSchema rejects a negative weightGrams", () => {
  const parsed = productSchema.safeParse({ ...baseInput(), weightGrams: "-5" })
  assert.equal(parsed.success, false)
})

test("productSchema rejects a negative lengthCm", () => {
  const parsed = productSchema.safeParse({ ...baseInput(), lengthCm: "-1" })
  assert.equal(parsed.success, false)
})

test("productSchema rejects a negative widthCm", () => {
  const parsed = productSchema.safeParse({ ...baseInput(), widthCm: "-10" })
  assert.equal(parsed.success, false)
})

test("productSchema rejects a negative heightCm", () => {
  const parsed = productSchema.safeParse({ ...baseInput(), heightCm: "-3" })
  assert.equal(parsed.success, false)
})

// ── Non-integer / invalid numeric values ──────

test("productSchema rejects a decimal weightGrams", () => {
  const parsed = productSchema.safeParse({ ...baseInput(), weightGrams: "750.5" })
  assert.equal(parsed.success, false)
})

test("productSchema rejects a decimal lengthCm", () => {
  const parsed = productSchema.safeParse({ ...baseInput(), lengthCm: "30.9" })
  assert.equal(parsed.success, false)
})

test("productSchema rejects a non-numeric weightGrams", () => {
  const parsed = productSchema.safeParse({ ...baseInput(), weightGrams: "heavy" })
  assert.equal(parsed.success, false)
})

test("productSchema rejects a non-numeric widthCm", () => {
  const parsed = productSchema.safeParse({ ...baseInput(), widthCm: "wide" })
  assert.equal(parsed.success, false)
})

test("productSchema rejects a non-numeric heightCm", () => {
  const parsed = productSchema.safeParse({ ...baseInput(), heightCm: "tall" })
  assert.equal(parsed.success, false)
})

test("productSchema rejects a non-numeric lengthCm", () => {
  const parsed = productSchema.safeParse({ ...baseInput(), lengthCm: "long" })
  assert.equal(parsed.success, false)
})

test("productSchema rejects a value with a leading sign on weightGrams", () => {
  // "+5" is not matched by the non-negative integer regex.
  const parsed = productSchema.safeParse({ ...baseInput(), weightGrams: "+5" })
  assert.equal(parsed.success, false)
})

// ── Existing required fields still enforced ───

test("productSchema still rejects a missing name (unchanged behaviour)", () => {
  const parsed = productSchema.safeParse({
    slug: "x",
    price: "1.00",
    categoryId: "c",
  })
  assert.equal(parsed.success, false)
})

test("productSchema still rejects an invalid price (unchanged behaviour)", () => {
  const parsed = productSchema.safeParse({
    ...baseInput(),
    price: "free",
  })
  assert.equal(parsed.success, false)
})
