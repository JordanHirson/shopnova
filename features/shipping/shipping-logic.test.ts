/**
 * ShopNova - Shipping business logic unit tests.
 *
 * Run with the project test runner (`npm test`). Pure functions only — no
 * real courier credentials or network required.
 */
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  buildQuoteRequest,
  isShippingDestinationComplete,
  isValidQuote,
  normalizeQuote,
  parcelsFromItemCount,
  quoteToSnapshot,
  selectCheapestQuote,
  shippingAddressFromDestination,
  snapshotToRate,
  DEFAULT_PARCEL_WEIGHT_GRAMS,
  DEFAULT_SHIPPING_CURRENCY,
} from "./shipping-logic.ts"

function completeDest() {
  return {
    shippingAddress: "123 Main Street",
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "8001",
    country: "South Africa",
  }
}

function validQuote(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    provider: "bobgo",
    method: "Standard shipping",
    rate: 49.99,
    currency: "ZAR",
    estimateDays: 3,
    ...overrides,
  }
}

// ── Destination completeness ──────────────────

test("complete destination passes the completeness check", () => {
  assert.equal(isShippingDestinationComplete(completeDest()), true)
})

test("missing any required field fails the completeness check", () => {
  for (const key of ["shippingAddress", "city", "province", "postalCode", "country"] as const) {
    const dest = { ...completeDest(), [key]: "" }
    assert.equal(isShippingDestinationComplete(dest), false, `${key} empty should fail`)
  }
})

test("whitespace-only fields fail the completeness check", () => {
  assert.equal(
    isShippingDestinationComplete({ ...completeDest(), city: "   " }),
    false
  )
})

test("undefined fields fail the completeness check", () => {
  assert.equal(isShippingDestinationComplete({}), false)
})

// ── Address mapping ───────────────────────────

test("shippingAddressFromDestination maps and trims fields", () => {
  const addr = shippingAddressFromDestination({
    shippingAddress: "  123 Main  ",
    city: "  Cape Town ",
    province: " Western Cape ",
    postalCode: " 8001 ",
    country: " South Africa ",
  })
  assert.equal(addr.street1, "123 Main")
  assert.equal(addr.city, "Cape Town")
  assert.equal(addr.province, "Western Cape")
  assert.equal(addr.postalCode, "8001")
  assert.equal(addr.country, "South Africa")
})

// ── Parcels ───────────────────────────────────

test("parcelsFromItemCount returns one parcel per item with default weight", () => {
  const parcels = parcelsFromItemCount(3)
  assert.equal(parcels.length, 3)
  for (const p of parcels) {
    assert.equal(p.weightGrams, DEFAULT_PARCEL_WEIGHT_GRAMS)
  }
})

test("parcelsFromItemCount floors to at least one parcel", () => {
  assert.equal(parcelsFromItemCount(0).length, 1)
  assert.equal(parcelsFromItemCount(2.9).length, 2)
  assert.equal(parcelsFromItemCount(-5).length, 1)
})

// ── Quote request building ────────────────────

test("buildQuoteRequest assembles origin, destination, parcels, currency", () => {
  const origin = { street1: "1 Depot", city: "Cape Town", province: "WC", postalCode: "8001", country: "South Africa" }
  const destination = { street1: "5 Home", city: "Joburg", province: "GP", postalCode: "2000", country: "South Africa" }
  const req = buildQuoteRequest({ origin, destination, subtotal: 120, itemCount: 2 })
  assert.equal(req.origin, origin)
  assert.equal(req.destination, destination)
  assert.equal(req.subtotal, 120)
  assert.equal(req.currency, DEFAULT_SHIPPING_CURRENCY)
  assert.equal(req.parcels.length, 2)
})

test("buildQuoteRequest honors an explicit currency", () => {
  const req = buildQuoteRequest({
    origin: { street1: "", city: "Cape Town", province: "WC", postalCode: "8001", country: "South Africa" },
    destination: { street1: "", city: "Joburg", province: "GP", postalCode: "2000", country: "South Africa" },
    subtotal: 10,
    currency: "USD",
    itemCount: 1,
  })
  assert.equal(req.currency, "USD")
})

// ── Quote normalization ───────────────────────

test("normalizeQuote accepts a well-formed quote", () => {
  const q = normalizeQuote(validQuote(), "ZAR")
  assert.deepEqual(q, {
    provider: "bobgo",
    method: "Standard shipping",
    rate: 49.99,
    currency: "ZAR",
    estimateDays: 3,
  })
})

test("normalizeQuote rejects an unknown provider", () => {
  assert.equal(normalizeQuote(validQuote({ provider: "unknown" }), "ZAR"), null)
})

test("normalizeQuote rejects a missing/empty method", () => {
  assert.equal(normalizeQuote(validQuote({ method: "" }), "ZAR"), null)
  assert.equal(normalizeQuote(validQuote({ method: "   " }), "ZAR"), null)
})

test("normalizeQuote rejects an over-long method", () => {
  assert.equal(
    normalizeQuote(validQuote({ method: "x".repeat(121) }), "ZAR"),
    null
  )
})

test("normalizeQuote rejects a negative rate", () => {
  assert.equal(normalizeQuote(validQuote({ rate: -5 }), "ZAR"), null)
})

test("normalizeQuote rejects a non-finite rate", () => {
  assert.equal(normalizeQuote(validQuote({ rate: Number.NaN }), "ZAR"), null)
  assert.equal(normalizeQuote(validQuote({ rate: Number.POSITIVE_INFINITY }), "ZAR"), null)
})

test("normalizeQuote accepts a zero rate (free shipping)", () => {
  const q = normalizeQuote(validQuote({ rate: 0 }), "ZAR")
  assert.equal(q?.rate, 0)
})

test("normalizeQuote rejects a currency mismatch (case-insensitive match allowed)", () => {
  assert.equal(normalizeQuote(validQuote({ currency: "USD" }), "ZAR"), null)
})

test("normalizeQuote matches currency case-insensitively", () => {
  const q = normalizeQuote(validQuote({ currency: "zar" }), "ZAR")
  assert.equal(q?.currency, "ZAR")
})

test("normalizeQuote coerces a numeric-string rate", () => {
  const q = normalizeQuote(validQuote({ rate: "49.99" }), "ZAR")
  assert.equal(q?.rate, 49.99)
})

test("normalizeQuote tolerates null/undefined estimateDays", () => {
  assert.equal(normalizeQuote(validQuote({ estimateDays: null }), "ZAR")?.estimateDays, null)
  assert.equal(normalizeQuote(validQuote({ estimateDays: undefined }), "ZAR")?.estimateDays, null)
})

test("normalizeQuote nulls out a malformed estimateDays", () => {
  assert.equal(normalizeQuote(validQuote({ estimateDays: -1 }), "ZAR")?.estimateDays, null)
  assert.equal(normalizeQuote(validQuote({ estimateDays: "soon" }), "ZAR")?.estimateDays, null)
})

test("normalizeQuote rejects a non-object input", () => {
  assert.equal(normalizeQuote(null, "ZAR"), null)
  assert.equal(normalizeQuote("not an object", "ZAR"), null)
  assert.equal(normalizeQuote(undefined, "ZAR"), null)
})

test("isValidQuote mirrors normalizeQuote", () => {
  assert.equal(isValidQuote({
    provider: "mvp", method: "Standard", rate: 5, currency: "ZAR", estimateDays: 5,
  }, "ZAR"), true)
  assert.equal(isValidQuote({
    provider: "mvp", method: "Standard", rate: -5, currency: "ZAR", estimateDays: 5,
  }, "ZAR"), false)
})

// ── Quote selection ───────────────────────────

test("selectCheapestQuote picks the lowest rate", () => {
  const quotes = [
    { provider: "bobgo" as const, method: "Standard", rate: 60, currency: "ZAR", estimateDays: 2 },
    { provider: "aramex" as const, method: "Express", rate: 40, currency: "ZAR", estimateDays: 1 },
    { provider: "pudo" as const, method: "Locker", rate: 50, currency: "ZAR", estimateDays: 4 },
  ]
  const selected = selectCheapestQuote(quotes, "ZAR")
  assert.equal(selected?.provider, "aramex")
  assert.equal(selected?.rate, 40)
})

test("selectCheapestQuote breaks ties by provider id deterministically", () => {
  const quotes = [
    { provider: "pudo" as const, method: "A", rate: 50, currency: "ZAR", estimateDays: null },
    { provider: "aramex" as const, method: "B", rate: 50, currency: "ZAR", estimateDays: null },
  ]
  const selected = selectCheapestQuote(quotes, "ZAR")
  assert.equal(selected?.provider, "aramex")
})

test("selectCheapestQuote filters out invalid quotes", () => {
  const quotes = [
    { provider: "bobgo" as const, method: "Standard", rate: 60, currency: "ZAR", estimateDays: 2 },
    { provider: "aramex" as const, method: "Express", rate: -10, currency: "ZAR", estimateDays: 1 },
  ]
  const selected = selectCheapestQuote(quotes, "ZAR")
  assert.equal(selected?.provider, "bobgo")
})

test("selectCheapestQuote returns null when no valid quote exists", () => {
  const quotes = [
    { provider: "aramex" as const, method: "Express", rate: -1, currency: "ZAR", estimateDays: 1 },
  ]
  assert.equal(selectCheapestQuote(quotes, "ZAR"), null)
  assert.equal(selectCheapestQuote([], "ZAR"), null)
})

test("selectCheapestQuote compares in cents to avoid float drift", () => {
  const quotes = [
    { provider: "bobgo" as const, method: "A", rate: 49.99, currency: "ZAR", estimateDays: null },
    { provider: "aramex" as const, method: "B", rate: 50.0, currency: "ZAR", estimateDays: null },
  ]
  assert.equal(selectCheapestQuote(quotes, "ZAR")?.provider, "bobgo")
})

// ── Snapshot round-trip ───────────────────────

test("quoteToSnapshot / snapshotToRate round-trip a trusted quote", () => {
  const quote = {
    provider: "bobgo" as const,
    method: "Standard shipping",
    rate: 49.99,
    currency: "ZAR",
    estimateDays: 3,
  }
  const snapshot = quoteToSnapshot(quote)
  const restored = snapshotToRate(snapshot, "ZAR")
  assert.deepEqual(restored, snapshot)
})

test("snapshotToRate rejects a corrupt/legacy snapshot", () => {
  assert.equal(snapshotToRate(null, "ZAR"), null)
  assert.equal(snapshotToRate(undefined, "ZAR"), null)
  assert.equal(snapshotToRate({ provider: "mvp", method: "X", rate: -5, currency: "ZAR" }, "ZAR"), null)
  assert.equal(snapshotToRate({ provider: "mvp", method: "X", rate: 5, currency: "USD" }, "ZAR"), null)
})
