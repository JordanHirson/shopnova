/**
 * ShopNova - Bob Go shipping-provider unit tests.
 *
 * Run with the project test runner (`npm test`). The provider module uses
 * `import "server-only"`; the test-register loader shims that marker package
 * so it imports here. `fetch` is mocked so no live Bob Go credentials or
 * network are required.
 *
 * Covers: successful quotes (every documented response shape), authentication
 * / configuration failures, malformed responses, invalid rates, currency
 * mismatches, API errors (HTTP 401/500, network failure), provider-specific
 * edge cases (failed provider_rate_requests, empty rates, multi-rate
 * selection through the registry), and the pure helpers (address/parcel
 * mapping, payload building, country normalization, default dimensions).
 */
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  BobGoProvider,
  BOBGO_PRODUCTION_URL,
  BOBGO_SANDBOX_URL,
  DEFAULT_PARCEL_HEIGHT_CM,
  DEFAULT_PARCEL_LENGTH_CM,
  DEFAULT_PARCEL_WIDTH_CM,
  bobGoAddress,
  bobGoConfigFromEnv,
  bobGoCountryCode,
  bobGoParcels,
  buildBobGoRatesPayload,
  parseBobGoRates,
} from "./bobgo.ts"
import {
  ShippingProviderError,
  type ShippingQuoteRequest,
} from "../shipping-provider.ts"
import { buildQuoteRequest } from "../shipping-logic.ts"
import {
  collectQuotesFromProviders,
  selectProvidersFromFactories,
} from "../provider-registry.ts"

// ── Fixtures ──────────────────────────────────

const CONFIG = { apiKey: "bg_test_key", baseUrl: BOBGO_SANDBOX_URL }

function request(subtotal = 100): ShippingQuoteRequest {
  return buildQuoteRequest({
    origin: {
      street1: "1 Depot Rd",
      city: "Cape Town",
      province: "Western Cape",
      postalCode: "8001",
      country: "South Africa",
    },
    destination: {
      street1: "5 Home St",
      street2: "Sandown",
      city: "Sandton",
      province: "Gauteng",
      postalCode: "2031",
      country: "South Africa",
    },
    subtotal,
    currency: "ZAR",
    itemCount: 2,
  })
}

/** Installs a mocked global `fetch` returning the given JSON body/status. */
function mockFetch(
  body: unknown,
  status = 200,
  headers: Record<string, string> = { "Content-Type": "application/json" }
): { restore: () => void; calls: Array<{ url: string; init?: RequestInit }> } {
  const original = globalThis.fetch
  const calls: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: typeof input === "string" ? input : input.toString(),
      init,
    })
    const bodyText =
      typeof body === "string" ? body : JSON.stringify(body)
    return new Response(bodyText, { status, headers })
  }) as typeof fetch
  return {
    calls,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

/** Installs a mocked global `fetch` that rejects (network failure). */
function mockFetchReject(err: unknown): { restore: () => void } {
  const original = globalThis.fetch
  globalThis.fetch = (async () => {
    throw err
  }) as typeof fetch
  return { restore: () => { globalThis.fetch = original } }
}

// ── Configuration ─────────────────────────────

test("bobGoConfigFromEnv returns null when BOBGO_API_KEY is absent", () => {
  assert.equal(bobGoConfigFromEnv({}), null)
  assert.equal(bobGoConfigFromEnv({ BOBGO_TEST_MODE: "true" }), null)
})

test("bobGoConfigFromEnv uses the production URL by default", () => {
  const cfg = bobGoConfigFromEnv({ BOBGO_API_KEY: "k" })
  assert.equal(cfg?.apiKey, "k")
  assert.equal(cfg?.baseUrl, BOBGO_PRODUCTION_URL)
})

test("bobGoConfigFromEnv uses the sandbox URL when BOBGO_TEST_MODE=true", () => {
  const cfg = bobGoConfigFromEnv({ BOBGO_API_KEY: "k", BOBGO_TEST_MODE: "true" })
  assert.equal(cfg?.baseUrl, BOBGO_SANDBOX_URL)
})

test("bobGoConfigFromEnv treats BOBGO_TEST_MODE != true as production", () => {
  const cfg = bobGoConfigFromEnv({ BOBGO_API_KEY: "k", BOBGO_TEST_MODE: "false" })
  assert.equal(cfg?.baseUrl, BOBGO_PRODUCTION_URL)
})

test("BobGoProvider.isConfigured is false without config", () => {
  assert.equal(new BobGoProvider(null).isConfigured(), false)
})

test("BobGoProvider.isConfigured is true with explicit config", () => {
  assert.equal(new BobGoProvider(CONFIG).isConfigured(), true)
})

test("BobGoProvider.id is bobgo", () => {
  assert.equal(new BobGoProvider(CONFIG).id, "bobgo")
})

// ── Country normalization ─────────────────────

test("bobGoCountryCode maps South Africa to ZA", () => {
  assert.equal(bobGoCountryCode("South Africa"), "ZA")
  assert.equal(bobGoCountryCode("south africa"), "ZA")
  assert.equal(bobGoCountryCode("RSA"), "ZA")
})

test("bobGoCountryCode uppercases a 2-letter code", () => {
  assert.equal(bobGoCountryCode("za"), "ZA")
  assert.equal(bobGoCountryCode("us"), "US")
})

test("bobGoCountryCode passes through an unknown value unchanged", () => {
  assert.equal(bobGoCountryCode("Namibia"), "Namibia")
})

// ── Address mapping ───────────────────────────

test("bobGoAddress maps all fields and uses street2 for local_area", () => {
  const addr = bobGoAddress({
    street1: "5 Home St",
    street2: "Sandown",
    city: "Sandton",
    province: "Gauteng",
    postalCode: "2031",
    country: "South Africa",
  })
  assert.equal(addr.street_address, "5 Home St")
  assert.equal(addr.local_area, "Sandown")
  assert.equal(addr.city, "Sandton")
  assert.equal(addr.zone, "Gauteng")
  assert.equal(addr.country, "ZA")
  assert.equal(addr.code, "2031")
  assert.equal(addr.company, "")
})

test("bobGoAddress falls back to city for local_area when street2 is absent", () => {
  const addr = bobGoAddress({
    street1: "5 Home St",
    city: "Sandton",
    province: "Gauteng",
    postalCode: "2031",
    country: "South Africa",
  })
  assert.equal(addr.local_area, "Sandton")
})

test("bobGoAddress treats a whitespace-only street2 as absent", () => {
  const addr = bobGoAddress({
    street1: "5 Home St",
    street2: "   ",
    city: "Sandton",
    province: "Gauteng",
    postalCode: "2031",
    country: "South Africa",
  })
  assert.equal(addr.local_area, "Sandton")
})

// ── Parcel mapping ────────────────────────────

test("bobGoParcels converts grams to kilograms and applies default dimensions", () => {
  const parcels = bobGoParcels([{ weightGrams: 1500 }])
  assert.equal(parcels.length, 1)
  assert.equal(parcels[0].submitted_weight_kg, 1.5)
  assert.equal(parcels[0].submitted_length_cm, DEFAULT_PARCEL_LENGTH_CM)
  assert.equal(parcels[0].submitted_width_cm, DEFAULT_PARCEL_WIDTH_CM)
  assert.equal(parcels[0].submitted_height_cm, DEFAULT_PARCEL_HEIGHT_CM)
  assert.equal(parcels[0].description, "Parcel")
})

test("bobGoParcels preserves explicit dimensions when provided", () => {
  const parcels = bobGoParcels([
    { weightGrams: 2000, lengthCm: 40, widthCm: 30, heightCm: 8 },
  ])
  assert.equal(parcels[0].submitted_length_cm, 40)
  assert.equal(parcels[0].submitted_width_cm, 30)
  assert.equal(parcels[0].submitted_height_cm, 8)
  assert.equal(parcels[0].submitted_weight_kg, 2)
})

test("bobGoParcels maps each parcel in the list", () => {
  const parcels = bobGoParcels([
    { weightGrams: 1000 },
    { weightGrams: 500, lengthCm: 10, widthCm: 10, heightCm: 10 },
  ])
  assert.equal(parcels.length, 2)
  assert.equal(parcels[0].submitted_weight_kg, 1)
  assert.equal(parcels[1].submitted_weight_kg, 0.5)
})

// ── Payload building ──────────────────────────

test("buildBobGoRatesPayload assembles the documented /rates body", () => {
  const payload = buildBobGoRatesPayload(request(120))
  assert.deepEqual(payload.collection_address, {
    company: "",
    street_address: "1 Depot Rd",
    local_area: "Cape Town",
    city: "Cape Town",
    zone: "Western Cape",
    country: "ZA",
    code: "8001",
  })
  assert.deepEqual(payload.delivery_address, {
    company: "",
    street_address: "5 Home St",
    local_area: "Sandown",
    city: "Sandton",
    zone: "Gauteng",
    country: "ZA",
    code: "2031",
  })
  assert.equal((payload.parcels as unknown[]).length, 2)
  assert.equal(payload.declared_value, 120)
  assert.equal(typeof payload.timeout, "number")
})

// ── Response parsing — documented shapes ──────

test("parseBobGoRates handles a bare JSON array of rates", () => {
  const quotes = parseBobGoRates([
    { total_price: 70.5, currency: "ZAR", service_name: "Overnight" },
    { total_price: 55, currency: "ZAR", service_level: { name: "Economy" } },
  ])
  assert.equal(quotes.length, 2)
  assert.equal(quotes[0].provider, "bobgo")
  assert.equal(quotes[0].rate, 70.5)
  assert.equal(quotes[0].currency, "ZAR")
  assert.equal(quotes[0].method, "Overnight")
  assert.equal(quotes[0].estimateDays, null)
  assert.equal(quotes[1].method, "Economy")
})

test("parseBobGoRates handles an object with a rates array", () => {
  const quotes = parseBobGoRates({
    rates: [{ rate: 60, currency: "zar", service_level_code: "ECO" }],
  })
  assert.equal(quotes.length, 1)
  assert.equal(quotes[0].rate, 60)
  assert.equal(quotes[0].currency, "ZAR")
  assert.equal(quotes[0].method, "ECO")
})

test("parseBobGoRates handles an object with a data array", () => {
  const quotes = parseBobGoRates({
    data: [{ rate_amount: 40, service_name: "Express" }],
  })
  assert.equal(quotes.length, 1)
  assert.equal(quotes[0].rate, 40)
  assert.equal(quotes[0].method, "Express")
  // Currency defaults to ZAR when not present.
  assert.equal(quotes[0].currency, "ZAR")
})

test("parseBobGoRates handles an object with a results array", () => {
  const quotes = parseBobGoRates({
    results: [{ total_price: 33, currency: "ZAR", provider_name: "TCG" }],
  })
  assert.equal(quotes.length, 1)
  assert.equal(quotes[0].method, "TCG")
})

test("parseBobGoRates handles provider_rate_requests with success responses", () => {
  const quotes = parseBobGoRates({
    provider_rate_requests: [
      {
        status: "success",
        provider_slug: "the-courier-guy",
        provider_name: "The Courier Guy",
        responses: [
          { total_price: 80, currency: "ZAR", service_level: { name: "Overnight" } },
          { total_price: 60, currency: "ZAR", service_level: { name: "Economy" } },
        ],
      },
      {
        status: "no-rates",
        provider_slug: "fastway",
        responses: [],
      },
    ],
  })
  assert.equal(quotes.length, 2)
  assert.equal(quotes[0].rate, 80)
  assert.equal(quotes[0].method, "Overnight")
  assert.equal(quotes[1].rate, 60)
})

test("parseBobGoRates stamps provider_name as the method fallback", () => {
  const quotes = parseBobGoRates({
    provider_rate_requests: [
      {
        status: "success",
        provider_name: "Aramex",
        provider_slug: "aramex",
        responses: [{ total_price: 90, currency: "ZAR" }],
      },
    ],
  })
  assert.equal(quotes[0].method, "Aramex")
})

test("parseBobGoRates skips a failed response status inside a successful request", () => {
  const quotes = parseBobGoRates({
    provider_rate_requests: [
      {
        status: "success",
        provider_name: "TCG",
        responses: [
          { status: "failed", total_price: 10, currency: "ZAR" },
          { total_price: 50, currency: "ZAR", service_name: "Economy" },
        ],
      },
    ],
  })
  assert.equal(quotes.length, 1)
  assert.equal(quotes[0].rate, 50)
})

test("parseBobGoRates returns [] for an empty rates array", () => {
  assert.deepEqual(parseBobGoRates({ rates: [] }), [])
  assert.deepEqual(parseBobGoRates([]), [])
})

test("parseBobGoRates returns [] for an unrecognized shape", () => {
  assert.deepEqual(parseBobGoRates({ unrelated: "value" }), [])
  assert.deepEqual(parseBobGoRates(null), [])
  assert.deepEqual(parseBobGoRates("not an object"), [])
  assert.deepEqual(parseBobGoRates(42), [])
})

test("parseBobGoRates discards a rate with a non-finite amount", () => {
  const quotes = parseBobGoRates([
    { total_price: "free", currency: "ZAR", service_name: "X" },
    { rate: Number.NaN, currency: "ZAR", service_name: "Y" },
    { total_price: 50, currency: "ZAR", service_name: "Z" },
  ])
  assert.equal(quotes.length, 1)
  assert.equal(quotes[0].rate, 50)
})

test("parseBobGoRates coerces a numeric-string amount", () => {
  const quotes = parseBobGoRates([
    { total_price: "70.25", currency: "ZAR", service_name: "Overnight" },
  ])
  assert.equal(quotes.length, 1)
  assert.equal(quotes[0].rate, 70.25)
})

test("parseBobGoRates accepts a zero amount (free shipping)", () => {
  const quotes = parseBobGoRates([
    { total_price: 0, currency: "ZAR", service_name: "Free" },
  ])
  assert.equal(quotes.length, 1)
  assert.equal(quotes[0].rate, 0)
})

test("parseBobGoRates falls back to the 'Bob Go' method label when none is derivable", () => {
  const quotes = parseBobGoRates([{ total_price: 50, currency: "ZAR" }])
  assert.equal(quotes.length, 1)
  assert.equal(quotes[0].method, "Bob Go")
})

// ── quote() — successful request ──────────────

test("quote() posts to /rates with Bearer auth and JSON body, returns quotes", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch({
    rates: [
      { total_price: 70, currency: "ZAR", service_name: "Overnight" },
      { total_price: 55, currency: "ZAR", service_name: "Economy" },
    ],
  })
  try {
    const quotes = await provider.quote(request())
    assert.equal(quotes.length, 2)
    assert.equal(quotes[0].provider, "bobgo")
    assert.equal(quotes[0].rate, 70)

    assert.equal(mock.calls.length, 1)
    assert.match(mock.calls[0].url, /\/rates$/)
    const headers = new Headers(mock.calls[0].init!.headers as HeadersInit)
    assert.equal(headers.get("Authorization"), "Bearer bg_test_key")
    assert.equal(headers.get("Content-Type"), "application/json")

    const body = JSON.parse(String(mock.calls[0].init!.body))
    assert.equal(body.declared_value, 100)
    assert.equal(body.parcels.length, 2)
    assert.equal(body.collection_address.country, "ZA")
  } finally {
    mock.restore()
  }
})

test("quote() uses the sandbox base URL when configured for sandbox", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch({ rates: [{ total_price: 50, currency: "ZAR", service_name: "X" }] })
  try {
    await provider.quote(request())
    assert.match(mock.calls[0].url, /^https:\/\/api\.sandbox\.bobgo\.co\.za\/v2\/rates$/)
  } finally {
    mock.restore()
  }
})

test("quote() uses the production base URL when configured for production", async () => {
  const provider = new BobGoProvider({ apiKey: "k", baseUrl: BOBGO_PRODUCTION_URL })
  const mock = mockFetch({ rates: [{ total_price: 50, currency: "ZAR", service_name: "X" }] })
  try {
    await provider.quote(request())
    assert.match(mock.calls[0].url, /^https:\/\/api\.bobgo\.co\.za\/v2\/rates$/)
  } finally {
    mock.restore()
  }
})

// ── quote() — configuration / auth failures ───

test("quote() throws ShippingProviderError when not configured", async () => {
  const provider = new BobGoProvider(null)
  await assert.rejects(
    () => provider.quote(request()),
    (err: unknown) => {
      assert.ok(err instanceof ShippingProviderError)
      assert.equal((err as ShippingProviderError).provider, "bobgo")
      assert.equal((err as ShippingProviderError).code, "not-configured")
      return true
    }
  )
})

test("quote() throws an http-error on HTTP 401 (bad/missing credentials)", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch({ message: "Unauthorized" }, 401)
  try {
    await assert.rejects(
      () => provider.quote(request()),
      (err: unknown) => {
        assert.ok(err instanceof ShippingProviderError)
        assert.equal((err as ShippingProviderError).code, "http-error")
        assert.match((err as Error).message, /HTTP 401/)
        return true
      }
    )
  } finally {
    mock.restore()
  }
})

test("quote() throws an http-error on HTTP 500", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch("internal server error", 500)
  try {
    await assert.rejects(
      () => provider.quote(request()),
      (err: unknown) => {
        assert.equal((err as ShippingProviderError).code, "http-error")
        assert.match((err as Error).message, /HTTP 500/)
        return true
      }
    )
  } finally {
    mock.restore()
  }
})

test("quote() throws a network-error when fetch rejects", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetchReject(new Error("ECONNREFUSED"))
  try {
    await assert.rejects(
      () => provider.quote(request()),
      (err: unknown) => {
        assert.ok(err instanceof ShippingProviderError)
        assert.equal((err as ShippingProviderError).code, "network-error")
        return true
      }
    )
  } finally {
    mock.restore()
  }
})

// ── quote() — malformed responses ─────────────

test("quote() throws malformed-response when the body is not JSON", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch("not json at all", 200, { "Content-Type": "text/plain" })
  try {
    await assert.rejects(
      () => provider.quote(request()),
      (err: unknown) => {
        assert.equal((err as ShippingProviderError).code, "malformed-response")
        return true
      }
    )
  } finally {
    mock.restore()
  }
})

test("quote() throws no-rates when the response has no rates", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch({ rates: [] })
  try {
    await assert.rejects(
      () => provider.quote(request()),
      (err: unknown) => {
        assert.equal((err as ShippingProviderError).code, "no-rates")
        return true
      }
    )
  } finally {
    mock.restore()
  }
})

test("quote() throws no-rates when every provider_rate_request failed", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch({
    provider_rate_requests: [{ status: "no-rates", responses: [] }],
  })
  try {
    await assert.rejects(
      () => provider.quote(request()),
      (err: unknown) => {
        assert.equal((err as ShippingProviderError).code, "no-rates")
        return true
      }
    )
  } finally {
    mock.restore()
  }
})

// ── Registry integration ───────────────────────

test("selectProvidersFromFactories registers Bob Go when configured and excludes MVP", () => {
  const providers = selectProvidersFromFactories([
    () => new BobGoProvider(CONFIG),
  ])
  assert.equal(providers.length, 1)
  assert.equal(providers[0].id, "bobgo")
})

test("selectProvidersFromFactories falls back to MVP when Bob Go is not configured", () => {
  const providers = selectProvidersFromFactories([
    () => new BobGoProvider(null),
  ])
  assert.equal(providers.length, 1)
  assert.equal(providers[0].id, "mvp")
})

test("collectQuotesFromProviders normalizes Bob Go quotes and selects the cheapest", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch({
    rates: [
      { total_price: 70, currency: "ZAR", service_name: "Overnight" },
      { total_price: 55, currency: "ZAR", service_name: "Economy" },
    ],
  })
  try {
    const quotes = await collectQuotesFromProviders([provider], request())
    assert.equal(quotes.length, 2)
    // Both quotes survive normalizeQuote (currency matches, finite rates).
    const rates = quotes.map((q) => q.rate).sort((a, b) => a - b)
    assert.deepEqual(rates, [55, 70])
  } finally {
    mock.restore()
  }
})

test("collectQuotesFromProviders discards a Bob Go quote with a mismatched currency", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch({
    rates: [{ total_price: 10, currency: "USD", service_name: "X" }],
  })
  try {
    // The only quote is in USD; normalizeQuote discards it for a ZAR request,
    // so the registry throws ShippingQuoteError (fail-closed — no fabricated rate).
    await assert.rejects(
      () => collectQuotesFromProviders([provider], request()),
      (err: unknown) => {
        assert.ok(err instanceof Error)
        return true
      }
    )
  } finally {
    mock.restore()
  }
})

test("collectQuotesFromProviders surfaces a ShippingQuoteError when Bob Go fails", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch({ message: "Unauthorized" }, 401)
  try {
    await assert.rejects(
      () => collectQuotesFromProviders([provider], request()),
      (err: unknown) => {
        assert.ok(err instanceof Error)
        // The driver failure is preserved on causes for server-side diagnostics.
        const causes = (err as { causes?: unknown[] }).causes
        assert.ok(Array.isArray(causes))
        assert.equal(causes!.length, 1)
        return true
      }
    )
  } finally {
    mock.restore()
  }
})

test("a Bob Go quote flows through the registry and produces a valid ZAR quote", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch({
    rates: [{ total_price: 49.99, currency: "ZAR", service_name: "Economy" }],
  })
  try {
    const quotes = await collectQuotesFromProviders([provider], request())
    assert.equal(quotes.length, 1)
    assert.equal(quotes[0].provider, "bobgo")
    assert.equal(quotes[0].rate, 49.99)
    assert.equal(quotes[0].currency, "ZAR")
    assert.equal(quotes[0].estimateDays, null)
  } finally {
    mock.restore()
  }
})

// ── Per-product weight/dimensions (Post-MVP #5) ──

test("bobGoParcels uses actual product weight (grams -> kg) when supplied", () => {
  const parcels = bobGoParcels([{ weightGrams: 750, lengthCm: 10, widthCm: 10, heightCm: 10 }])
  assert.equal(parcels[0].submitted_weight_kg, 0.75)
})

test("bobGoParcels uses actual dimensions when supplied", () => {
  const parcels = bobGoParcels([
    { weightGrams: 1000, lengthCm: 25, widthCm: 18, heightCm: 6 },
  ])
  assert.equal(parcels[0].submitted_length_cm, 25)
  assert.equal(parcels[0].submitted_width_cm, 18)
  assert.equal(parcels[0].submitted_height_cm, 6)
})

test("bobGoParcels applies default dimensions per-field when a dimension is missing", () => {
  // weight supplied but no dimensions -> weight kept, all dims default.
  const parcels = bobGoParcels([{ weightGrams: 500 }])
  assert.equal(parcels[0].submitted_weight_kg, 0.5)
  assert.equal(parcels[0].submitted_length_cm, DEFAULT_PARCEL_LENGTH_CM)
  assert.equal(parcels[0].submitted_width_cm, DEFAULT_PARCEL_WIDTH_CM)
  assert.equal(parcels[0].submitted_height_cm, DEFAULT_PARCEL_HEIGHT_CM)
})

test("bobGoParcels applies default dimensions per-field for partial dimensions", () => {
  // length supplied, width/height missing -> length kept, width/height default.
  const parcels = bobGoParcels([{ weightGrams: 500, lengthCm: 40 }])
  assert.equal(parcels[0].submitted_length_cm, 40)
  assert.equal(parcels[0].submitted_width_cm, DEFAULT_PARCEL_WIDTH_CM)
  assert.equal(parcels[0].submitted_height_cm, DEFAULT_PARCEL_HEIGHT_CM)
})

test("quote() sends actual product weight and dimensions in the /rates body", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch({ rates: [{ total_price: 60, currency: "ZAR", service_name: "X" }] })
  try {
    const req = buildQuoteRequest({
      origin: {
        street1: "1 Depot Rd",
        city: "Cape Town",
        province: "Western Cape",
        postalCode: "8001",
        country: "South Africa",
      },
      destination: {
        street1: "5 Home St",
        city: "Sandton",
        province: "Gauteng",
        postalCode: "2031",
        country: "South Africa",
      },
      subtotal: 100,
      currency: "ZAR",
      itemCount: 1,
      lines: [{ quantity: 1, weightGrams: 1200, lengthCm: 35, widthCm: 22, heightCm: 12 }],
    })
    await provider.quote(req)
    const body = JSON.parse(String(mock.calls[0].init!.body))
    assert.equal(body.parcels.length, 1)
    assert.equal(body.parcels[0].submitted_weight_kg, 1.2)
    assert.equal(body.parcels[0].submitted_length_cm, 35)
    assert.equal(body.parcels[0].submitted_width_cm, 22)
    assert.equal(body.parcels[0].submitted_height_cm, 12)
  } finally {
    mock.restore()
  }
})

test("quote() emits one parcel per unit for quantity > 1 (no dimension multiplication)", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch({ rates: [{ total_price: 80, currency: "ZAR", service_name: "X" }] })
  try {
    const req = buildQuoteRequest({
      origin: {
        street1: "1 Depot Rd",
        city: "Cape Town",
        province: "Western Cape",
        postalCode: "8001",
        country: "South Africa",
      },
      destination: {
        street1: "5 Home St",
        city: "Sandton",
        province: "Gauteng",
        postalCode: "2031",
        country: "South Africa",
      },
      subtotal: 300,
      currency: "ZAR",
      itemCount: 3,
      lines: [{ quantity: 3, weightGrams: 900, lengthCm: 20, widthCm: 15, heightCm: 7 }],
    })
    await provider.quote(req)
    const body = JSON.parse(String(mock.calls[0].init!.body))
    assert.equal(body.parcels.length, 3)
    for (const p of body.parcels) {
      assert.equal(p.submitted_weight_kg, 0.9)
      assert.equal(p.submitted_length_cm, 20)
      assert.equal(p.submitted_width_cm, 15)
      assert.equal(p.submitted_height_cm, 7)
    }
  } finally {
    mock.restore()
  }
})

test("quote() uses fallback dimensions/weight for a product without physical data", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch({ rates: [{ total_price: 50, currency: "ZAR", service_name: "X" }] })
  try {
    const req = buildQuoteRequest({
      origin: {
        street1: "1 Depot Rd",
        city: "Cape Town",
        province: "Western Cape",
        postalCode: "8001",
        country: "South Africa",
      },
      destination: {
        street1: "5 Home St",
        city: "Sandton",
        province: "Gauteng",
        postalCode: "2031",
        country: "South Africa",
      },
      subtotal: 100,
      currency: "ZAR",
      itemCount: 1,
      lines: [{ quantity: 1, weightGrams: null, lengthCm: null, widthCm: null, heightCm: null }],
    })
    await provider.quote(req)
    const body = JSON.parse(String(mock.calls[0].init!.body))
    assert.equal(body.parcels.length, 1)
    // weight falls back to DEFAULT_PARCEL_WEIGHT_GRAMS (1000g -> 1kg) in parcelsFromLines.
    assert.equal(body.parcels[0].submitted_weight_kg, 1)
    // dimensions fall back to DEFAULT_PARCEL_*_CM in bobGoParcels.
    assert.equal(body.parcels[0].submitted_length_cm, DEFAULT_PARCEL_LENGTH_CM)
    assert.equal(body.parcels[0].submitted_width_cm, DEFAULT_PARCEL_WIDTH_CM)
    assert.equal(body.parcels[0].submitted_height_cm, DEFAULT_PARCEL_HEIGHT_CM)
  } finally {
    mock.restore()
  }
})

test("quote() treats a zero weight/dimension as missing (fallback)", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch({ rates: [{ total_price: 50, currency: "ZAR", service_name: "X" }] })
  try {
    const req = buildQuoteRequest({
      origin: {
        street1: "1 Depot Rd",
        city: "Cape Town",
        province: "Western Cape",
        postalCode: "8001",
        country: "South Africa",
      },
      destination: {
        street1: "5 Home St",
        city: "Sandton",
        province: "Gauteng",
        postalCode: "2031",
        country: "South Africa",
      },
      subtotal: 100,
      currency: "ZAR",
      itemCount: 1,
      lines: [{ quantity: 1, weightGrams: 0, lengthCm: 0, widthCm: 0, heightCm: 0 }],
    })
    await provider.quote(req)
    const body = JSON.parse(String(mock.calls[0].init!.body))
    assert.equal(body.parcels[0].submitted_weight_kg, 1)
    assert.equal(body.parcels[0].submitted_length_cm, DEFAULT_PARCEL_LENGTH_CM)
  } finally {
    mock.restore()
  }
})

test("quote() combines multiple product lines into one parcels array", async () => {
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch({ rates: [{ total_price: 70, currency: "ZAR", service_name: "X" }] })
  try {
    const req = buildQuoteRequest({
      origin: {
        street1: "1 Depot Rd",
        city: "Cape Town",
        province: "Western Cape",
        postalCode: "8001",
        country: "South Africa",
      },
      destination: {
        street1: "5 Home St",
        city: "Sandton",
        province: "Gauteng",
        postalCode: "2031",
        country: "South Africa",
      },
      subtotal: 250,
      currency: "ZAR",
      itemCount: 3,
      lines: [
        { quantity: 2, weightGrams: 1000, lengthCm: 30, widthCm: 20, heightCm: 10 },
        { quantity: 1, weightGrams: 200, lengthCm: 8, widthCm: 8, heightCm: 4 },
      ],
    })
    await provider.quote(req)
    const body = JSON.parse(String(mock.calls[0].init!.body))
    assert.equal(body.parcels.length, 3)
    assert.equal(body.parcels[0].submitted_weight_kg, 1)
    assert.equal(body.parcels[0].submitted_length_cm, 30)
    assert.equal(body.parcels[2].submitted_weight_kg, 0.2)
    assert.equal(body.parcels[2].submitted_length_cm, 8)
  } finally {
    mock.restore()
  }
})

test("response parsing and quote normalization remain unchanged with dimensions", async () => {
  // Existing response parsing is dimension-agnostic; verify a multi-shape
  // response still normalizes correctly when parcels carry real dimensions.
  const provider = new BobGoProvider(CONFIG)
  const mock = mockFetch({
    provider_rate_requests: [
      {
        status: "success",
        provider_name: "The Courier Guy",
        responses: [
          { total_price: 65, currency: "ZAR", service_level: { name: "Overnight" } },
          { total_price: 45, currency: "ZAR", service_level: { name: "Economy" } },
        ],
      },
    ],
  })
  try {
    const req = buildQuoteRequest({
      origin: {
        street1: "1 Depot Rd",
        city: "Cape Town",
        province: "Western Cape",
        postalCode: "8001",
        country: "South Africa",
      },
      destination: {
        street1: "5 Home St",
        city: "Sandton",
        province: "Gauteng",
        postalCode: "2031",
        country: "South Africa",
      },
      subtotal: 200,
      currency: "ZAR",
      itemCount: 2,
      lines: [{ quantity: 2, weightGrams: 1500, lengthCm: 40, widthCm: 30, heightCm: 15 }],
    })
    const quotes = await provider.quote(req)
    assert.equal(quotes.length, 2)
    assert.equal(quotes[0].provider, "bobgo")
    assert.equal(quotes[0].currency, "ZAR")
    assert.equal(quotes[0].estimateDays, null)
    const rates = quotes.map((q) => q.rate).sort((a, b) => a - b)
    assert.deepEqual(rates, [45, 65])
  } finally {
    mock.restore()
  }
})
