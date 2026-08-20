/**
 * ShopNova - Payment business logic unit tests.
 *
 * Run with: node --test --experimental-strip-types features/payment/payment-logic.test.ts
 *
 * Covers the guidebook's security-critical payment behavior that can be
 * verified with pure functions (no DB, no real provider credentials):
 * - Payment amount is derived from authoritative server-side values.
 * - Unsupported payment provider is rejected.
 * - Provider selection routes SA -> PayFast, international -> Stripe.
 */
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  amountMatches,
  providerAmountFromTotal,
  resolveProvider,
  selectProviderForCountry,
  SOUTH_AFRICA_COUNTRY,
  SUPPORTED_PROVIDERS,
  toAmountCents,
} from "./payment-logic.ts"

// ── Authoritative amount ──────────────────────

test("toAmountCents converts currency units to minor units (cents)", () => {
  assert.equal(toAmountCents(0), 0)
  assert.equal(toAmountCents(1), 100)
  assert.equal(toAmountCents(1.5), 150)
  assert.equal(toAmountCents(19.99), 1999)
})

test("toAmountCents rounds fractional cents away from float drift", () => {
  assert.equal(toAmountCents(0.1 + 0.2), 30)
})

test("providerAmountFromTotal is the authoritative total in cents", () => {
  assert.equal(providerAmountFromTotal(115), 11500)
})

test("amountMatches accepts a server total that equals the gateway amount", () => {
  assert.equal(amountMatches(115, 11500), true)
})

test("amountMatches rejects a tampered client total that does not match the gateway", () => {
  // A browser-supplied total of 1.00 cannot match a server-computed
  // total of 115.00 reflected by the gateway's 11500 cents charge.
  assert.equal(amountMatches(1, 11500), false)
  assert.equal(amountMatches(115, 1), false)
  assert.equal(amountMatches(115.01, 11500), false)
})

// ── Provider selection ─────────────────────────

test("South Africa routes to PayFast by default", () => {
  assert.equal(selectProviderForCountry(SOUTH_AFRICA_COUNTRY), "payfast")
  assert.equal(selectProviderForCountry("south africa"), "payfast")
  assert.equal(selectProviderForCountry("  South Africa  "), "payfast")
})

test("International destinations route to Stripe", () => {
  assert.equal(selectProviderForCountry("United States"), "stripe")
  assert.equal(selectProviderForCountry("Germany"), "stripe")
  assert.equal(selectProviderForCountry("Japan"), "stripe")
})

// ── Provider resolution ────────────────────────

test("resolveProvider accepts a supported, configured provider", () => {
  assert.equal(resolveProvider("stripe", ["stripe", "payfast"]), "stripe")
  assert.equal(resolveProvider("payfast", ["stripe", "payfast"]), "payfast")
})

test("resolveProvider rejects an unsupported provider id", () => {
  assert.equal(resolveProvider("yoco", ["stripe", "payfast"]), null)
  assert.equal(resolveProvider("stitch", ["stripe", "payfast"]), null)
  assert.equal(resolveProvider("", ["stripe", "payfast"]), null)
  assert.equal(resolveProvider("STRIPE", ["stripe", "payfast"]), null) // case-sensitive
})

test("resolveProvider rejects a supported but unconfigured provider", () => {
  // Stripe is supported but not configured (no secret keys) -> null.
  assert.equal(resolveProvider("stripe", ["payfast"]), null)
  assert.equal(resolveProvider("payfast", ["stripe"]), null)
})

test("SUPPORTED_PROVIDERS includes stripe, payfast, and the test gateway", () => {
  assert.deepEqual([...SUPPORTED_PROVIDERS], ["stripe", "payfast", "test"])
})
