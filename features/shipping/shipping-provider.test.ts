/**
 * ShopNova - Shipping provider + registry unit tests.
 *
 * Run with the project test runner (`npm test`). Uses the FakeShippingProvider
 * and the extracted pure registry helpers so no real courier credentials or
 * network are required. The `server-only` marker is shimmed by
 * `scripts/test-register.mjs` so the registry module can be imported.
 */
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  FakeShippingProvider,
  MvpShippingProvider,
  ShippingProviderError,
  type ShippingProviderId,
  type ShippingQuote,
  type ShippingQuoteRequest,
} from "./shipping-provider.ts"
import {
  collectQuotesFromProviders,
  getShippingOrigin,
  selectProvidersFromFactories,
  ShippingQuoteError,
} from "./provider-registry.ts"
import { buildQuoteRequest } from "./shipping-logic.ts"
import {
  calculateOrderTotal,
  calculateShipping,
  calculateVat,
  FREE_SHIPPING_THRESHOLD,
} from "../checkout/checkout-logic.ts"
import { checkoutSchema } from "../../lib/validations/checkout.ts"

function request(subtotal = 100): ShippingQuoteRequest {
  return buildQuoteRequest({
    origin: { street1: "1 Depot", city: "Cape Town", province: "WC", postalCode: "8001", country: "South Africa" },
    destination: { street1: "5 Home", city: "Joburg", province: "GP", postalCode: "2000", country: "South Africa" },
    subtotal,
    currency: "ZAR",
    itemCount: 1,
  })
}

function q(provider: ShippingProviderId, rate: number, method = "Standard", estimateDays: number | null = 3): ShippingQuote {
  return { provider, method, rate, currency: "ZAR", estimateDays }
}

/** Casts a raw object to `ShippingQuote` to simulate a provider that returns
 *  a malformed/unvalidated response despite the type — exercising the
 *  registry's `normalizeQuote` defense. */
function raw(obj: unknown): ShippingQuote {
  return obj as ShippingQuote
}

// ── MvpShippingProvider ───────────────────────

test("MvpShippingProvider is always configured", () => {
  assert.equal(new MvpShippingProvider().isConfigured(), true)
})

test("MvpShippingProvider quotes free shipping at/above the threshold", async () => {
  const provider = new MvpShippingProvider()
  const quotes = await provider.quote(request(FREE_SHIPPING_THRESHOLD))
  assert.equal(quotes.length, 1)
  assert.equal(quotes[0].rate, 0)
  assert.equal(quotes[0].method, "Free shipping")
  assert.equal(quotes[0].currency, "ZAR")
  assert.equal(quotes[0].estimateDays, null)
})

test("MvpShippingProvider quotes the flat rate below the threshold", async () => {
  const provider = new MvpShippingProvider()
  const quotes = await provider.quote(request(20))
  assert.equal(quotes[0].rate, 5)
  assert.equal(quotes[0].method, "Standard shipping")
  assert.equal(quotes[0].estimateDays, 5)
})

test("MvpShippingProvider rate matches the deterministic checkout rule", async () => {
  const provider = new MvpShippingProvider()
  for (const subtotal of [0, 10, 49.99, 50, 120.5]) {
    const quotes = await provider.quote(request(subtotal))
    assert.equal(quotes[0].rate, calculateShipping(subtotal), `subtotal ${subtotal}`)
  }
})

// ── FakeShippingProvider ──────────────────────

test("FakeShippingProvider returns the supplied quotes", async () => {
  const provider = new FakeShippingProvider({
    id: "bobgo",
    quotes: [q("bobgo", 40, "Express", 1), q("bobgo", 30, "Economy", 4)],
  })
  const quotes = await provider.quote(request())
  assert.equal(quotes.length, 2)
  assert.equal(quotes[0].rate, 40)
  // Currency is stamped from the request.
  assert.equal(quotes[0].currency, "ZAR")
})

test("FakeShippingProvider can simulate failure", async () => {
  const provider = new FakeShippingProvider({ id: "aramex", fail: true })
  await assert.rejects(() => provider.quote(request()), (err: unknown) => {
    assert.ok(err instanceof ShippingProviderError)
    assert.equal((err as ShippingProviderError).provider, "aramex")
    return true
  })
})

test("FakeShippingProvider respects the configured flag", () => {
  assert.equal(new FakeShippingProvider({ id: "pudo", configured: false }).isConfigured(), false)
  assert.equal(new FakeShippingProvider({ id: "pudo", configured: true }).isConfigured(), true)
})

test("FakeShippingProvider supports a quote factory", async () => {
  let calls = 0
  const provider = new FakeShippingProvider({
    id: "courier-guy",
    quoteFactory: () => {
      calls++
      return [q("courier-guy", 55)]
    },
  })
  const quotes = await provider.quote(request())
  assert.equal(quotes.length, 1)
  assert.equal(calls, 1)
})

test("FakeShippingProvider rejects both quotes and quoteFactory", () => {
  assert.throws(() =>
    new FakeShippingProvider({
      id: "bobgo",
      quotes: [q("bobgo", 40)],
      quoteFactory: () => [q("bobgo", 40)],
    })
  )
})

// ── Provider selection ────────────────────────

test("selectProvidersFromFactories falls back to MVP when no live courier is configured", () => {
  const providers = selectProvidersFromFactories([])
  assert.equal(providers.length, 1)
  assert.equal(providers[0].id, "mvp")
})

test("selectProvidersFromFactories returns only live couriers when at least one is configured", () => {
  const providers = selectProvidersFromFactories([
    () => new FakeShippingProvider({ id: "bobgo" }),
    () => new FakeShippingProvider({ id: "aramex" }),
  ])
  assert.equal(providers.length, 2)
  assert.ok(providers.every((p) => p.id !== "mvp"))
})

test("selectProvidersFromFactories skips factories that return null", () => {
  const providers = selectProvidersFromFactories([
    () => null,
    () => new FakeShippingProvider({ id: "bobgo" }),
  ])
  assert.equal(providers.length, 1)
  assert.equal(providers[0].id, "bobgo")
})

test("selectProvidersFromFactories skips unconfigured live couriers and falls back to MVP", () => {
  const providers = selectProvidersFromFactories([
    () => new FakeShippingProvider({ id: "aramex", configured: false }),
  ])
  assert.equal(providers.length, 1)
  assert.equal(providers[0].id, "mvp")
})

// ── Quote fan-out ─────────────────────────────

test("collectQuotesFromProviders returns valid quotes from all providers", async () => {
  const providers = [
    new FakeShippingProvider({ id: "bobgo", quotes: [q("bobgo", 40)] }),
    new FakeShippingProvider({ id: "aramex", quotes: [q("aramex", 35)] }),
  ]
  const quotes = await collectQuotesFromProviders(providers, request())
  assert.equal(quotes.length, 2)
})

test("collectQuotesFromProviders keeps working quotes when one provider fails", async () => {
  const providers = [
    new FakeShippingProvider({ id: "bobgo", fail: true }),
    new FakeShippingProvider({ id: "aramex", quotes: [q("aramex", 35)] }),
  ]
  const quotes = await collectQuotesFromProviders(providers, request())
  assert.equal(quotes.length, 1)
  assert.equal(quotes[0].provider, "aramex")
})

test("collectQuotesFromProviders throws ShippingQuoteError when every provider fails", async () => {
  const providers = [
    new FakeShippingProvider({ id: "bobgo", fail: true }),
    new FakeShippingProvider({ id: "aramex", fail: true }),
  ]
  await assert.rejects(
    () => collectQuotesFromProviders(providers, request()),
    (err: unknown) => {
      assert.ok(err instanceof ShippingQuoteError)
      assert.equal((err as ShippingQuoteError).causes.length, 2)
      assert.match((err as Error).message, /shipping quote/i)
      return true
    }
  )
})

test("collectQuotesFromProviders throws when no providers return a valid quote", async () => {
  const providers = [
    new FakeShippingProvider({ id: "bobgo", quoteFactory: () => [] }),
  ]
  await assert.rejects(
    () => collectQuotesFromProviders(providers, request()),
    ShippingQuoteError
  )
})

test("collectQuotesFromProviders discards malformed provider responses", async () => {
  const providers = [
    new FakeShippingProvider({
      id: "bobgo",
      quoteFactory: () => [
        q("bobgo", 40),
        raw({ provider: "unknown", method: "X", rate: 1, currency: "ZAR", estimateDays: 1 }),
        raw({ provider: "bobgo", method: "", rate: 1, currency: "ZAR", estimateDays: 1 }),
        raw({ provider: "bobgo", method: "Y", rate: -5, currency: "ZAR", estimateDays: 1 }),
      ],
    }),
  ]
  const quotes = await collectQuotesFromProviders(providers, request())
  assert.equal(quotes.length, 1)
  assert.equal(quotes[0].rate, 40)
})

test("collectQuotesFromProviders discards quotes with a mismatched currency", async () => {
  const providers = [
    new FakeShippingProvider({
      id: "bobgo",
      quoteFactory: () => [
        raw({ provider: "bobgo", method: "USD quote", rate: 10, currency: "USD", estimateDays: 2 }),
      ],
    }),
  ]
  await assert.rejects(
    () => collectQuotesFromProviders(providers, request()),
    ShippingQuoteError
  )
})

test("collectQuotesFromProviders throws for an empty provider list", async () => {
  await assert.rejects(
    () => collectQuotesFromProviders([], request()),
    ShippingQuoteError
  )
})

// ── Origin configuration ──────────────────────

test("getShippingOrigin returns SA defaults when env is unset", () => {
  const origin = getShippingOrigin({})
  assert.equal(origin.city, "Cape Town")
  assert.equal(origin.country, "South Africa")
  assert.equal(origin.postalCode, "8001")
})

test("getShippingOrigin reads overrides from env and trims them", () => {
  const origin = getShippingOrigin({
    SHIPPING_ORIGIN_CITY: "  Durban  ",
    SHIPPING_ORIGIN_PROVINCE: " KZN ",
    SHIPPING_ORIGIN_POSTAL_CODE: " 4000 ",
    SHIPPING_ORIGIN_COUNTRY: " South Africa ",
    SHIPPING_ORIGIN_STREET: " 9 Warehouse Rd ",
  })
  assert.equal(origin.city, "Durban")
  assert.equal(origin.province, "KZN")
  assert.equal(origin.postalCode, "4000")
  assert.equal(origin.country, "South Africa")
  assert.equal(origin.street1, "9 Warehouse Rd")
})

// ── Checkout total integration ─────────────────

test("checkout total uses the server quote rate, not a client-supplied shipping amount", () => {
  // The server obtains an authoritative quote (rate = 49.99) for a
  // destination. The order total is computed from the server subtotal,
  // the server quote rate, and server VAT — never from a client value.
  const subtotal = 100
  const serverQuoteRate = 49.99
  const vat = calculateVat(subtotal)
  const total = calculateOrderTotal(subtotal, serverQuoteRate, vat)

  // A malicious client tries to force free shipping.
  const clientSuppliedShipping = 0
  const forgedTotal = calculateOrderTotal(subtotal, clientSuppliedShipping, vat)

  assert.notEqual(total, forgedTotal)
  assert.equal(total, subtotal + serverQuoteRate + vat)
})

test("the checkout form schema has no shipping-amount field the client can submit", () => {
  // A client cannot inject a shipping price through the form: Zod strips
  // unknown keys, and the schema defines only contact + address fields.
  const validForm = {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "+27 1",
    shippingAddress: "123 Main",
    city: "Cape Town",
    province: "WC",
    postalCode: "8001",
    country: "South Africa",
    // Malicious attempts:
    shipping: 0,
    shippingTotal: 0,
    shippingAmount: 0,
    shippingRate: 0,
  }
  const parsed = checkoutSchema.safeParse(validForm)
  assert.equal(parsed.success, true)
  assert.equal("shipping" in parsed.data, false)
  assert.equal("shippingTotal" in parsed.data, false)
  assert.equal("shippingAmount" in parsed.data, false)
  assert.equal("shippingRate" in parsed.data, false)
})

test("checkout total with the MVP free-shipping quote is subtotal + vat", () => {
  const subtotal = FREE_SHIPPING_THRESHOLD
  const shipping = calculateShipping(subtotal) // 0 (free)
  const vat = calculateVat(subtotal)
  assert.equal(calculateOrderTotal(subtotal, shipping, vat), subtotal + vat)
})
