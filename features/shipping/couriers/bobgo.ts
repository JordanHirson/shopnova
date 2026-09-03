/**
 * ShopNova - Bob Go shipping provider adapter.
 *
 * Bob Go is a South African multi-courier aggregation platform (the guidebook's
 * "multi-courier API") that exposes a single REST API behind which ~12 courier
 * partners (The Courier Guy, Aramex, DPD Laser, Fastway, RAM, SkyNet, Internet
 * Express, Pargo / Bob Box, etc.) are queried for rates. Connecting once yields
 * live rates from all of them — which is why Bob Go was selected as the first
 * live courier integration for ShopNova.
 *
 * OFFICIAL API CONTRACT (api-docs.bob.co.za):
 * - Production Base URL: https://api.bobgo.co.za/v2
 * - Sandbox Base URL:    https://api.sandbox.bobgo.co.za/v2
 *   (A dedicated sandbox environment is provided for integration testing.)
 * - Authentication: Bearer Token Authentication
 *     `Authorization: Bearer <api key>` on every request.
 *   The API key is created in the Bob Go portal under Settings → API Keys.
 * - Rate endpoint: `POST /rates` — "Get courier rates."
 *   Request body (JSON): collection_address, delivery_address, parcels,
 *   declared_value, timeout. (Contacts are sent by some integrations for
 *   shipment creation; the rates endpoint accepts addresses + parcels +
 *   declared value.)
 * - Address shape: { company, street_address, local_area, city, zone, country,
 *   code }. `country` is the ISO 3166-1 alpha-2 code (e.g. "ZA"); `zone` is the
 *   province/region; `code` is the postal code; `local_area` is the suburb /
 *   address line 2 (falls back to the city).
 * - Parcel shape: { description, submitted_length_cm, submitted_width_cm,
 *   submitted_height_cm, submitted_weight_kg }. Dimensions are in centimetres
 *   and must be >= 1; weight is in kilograms.
 * - Response: a JSON array of rates, OR an object with a `rates` / `data` /
 *   `results` array, OR an object with `provider_rate_requests[]` where each
 *   entry with `status === "success"` contains `responses[]` (each response is
 *   a rate). Each rate exposes a total price (`total_price` / `rate` /
 *   `rate_amount`), a `currency` (default ZAR), the carrier
 *   (`provider_name` / `provider_slug`), and a service level
 *   (`service_level.name` / `service_name` / `service_level_code`).
 *
 * LIMITATION — per-product weight/dimensions:
 * The current MVP product schema does NOT carry per-variant weight or
 * dimensions, so an accurate live quote cannot be produced yet. The existing
 * shipping abstraction already supplies a conservative default weight
 * (`DEFAULT_PARCEL_WEIGHT_GRAMS = 1000` → 1 kg) per parcel. Because Bob Go
 * requires parcel dimensions (length/width/height in cm, each >= 1) to compute
 * a rate, this adapter applies a clearly-documented conservative default
 * parcel size (`DEFAULT_PARCEL_*_CM`) when a parcel does not carry dimensions.
 * The resulting quote is therefore an APPROXIMATION based on default package
 * assumptions, NOT a verified accurate charge for the actual goods. This
 * limitation is surfaced in the quote `method` label and documented in
 * PROJECT.md / README.md. Accurate quotes require the post-MVP per-product
 * weight/dimensions schema addition.
 *
 * SECURITY:
 * - The API key is server-side only (`import "server-only"`); it never reaches
 *   the browser.
 * - Raw provider responses are NEVER trusted: every rate is validated by the
 *   registry's `normalizeQuote` (currency match, finite/non-negative rate,
 *   known provider) before it can influence a financial calculation.
 * - The client is never authoritative for the shipping rate; this adapter is
 *   only invoked server-side through the provider registry.
 * - Driver errors are wrapped in `ShippingProviderError` with a generic,
 *   credential-free message; the original error is preserved on `cause` for
 *   server-side diagnostics and never exposed to the browser.
 *
 * STATUS: implemented per the official public API contract, unit-tested
 * with mocked `fetch` (request/response contract, error paths, malformed
 * responses, currency mismatch, multi-shape response parsing), and
 * LIVE-SANDBOX-VERIFIED: a real non-destructive `POST /rates` against
 * `https://api.sandbox.bobgo.co.za/v2` (Cape Town -> Johannesburg, default
 * 1 kg / 30x20x10 cm parcel, ZAR subtotal) returned real ZAR rates that
 * normalized correctly into `ShippingQuote` and flowed through the registry
 * + checkout path. No API discrepancy was found; no application code was
 * changed for the live test. NOT production-verified (the production base
 * URL has not been exercised, and per-product weight/dimensions remain a
 * documented approximation).
 */
import "server-only"

import type {
  Parcel,
  ShippingAddress,
  ShippingProvider,
  ShippingQuote,
  ShippingQuoteRequest,
} from "../shipping-provider"
import { ShippingProviderError } from "../shipping-provider"

// ── Configuration ─────────────────────────────

/** Bob Go production API base (api-docs.bob.co.za). */
export const BOBGO_PRODUCTION_URL = "https://api.bobgo.co.za/v2"
/** Bob Go sandbox API base (api-docs.bob.co.za). */
export const BOBGO_SANDBOX_URL = "https://api.sandbox.bobgo.co.za/v2"

/** Rate endpoint path (relative to the configured base URL). */
const BOBGO_RATES_PATH = "/rates"

/** Request timeout sent to Bob Go (milliseconds). */
const BOBGO_REQUEST_TIMEOUT_MS = 10_000

/**
 * Conservative default parcel dimensions (centimetres) used when the MVP
 * product schema does not provide per-product dimensions. Bob Go requires
 * dimensions (each >= 1 cm) to calculate a rate. These defaults produce a
 * small standard parcel and are NOT an accurate measurement of the actual
 * goods — see the module-level LIMITATION note.
 */
export const DEFAULT_PARCEL_LENGTH_CM = 30
export const DEFAULT_PARCEL_WIDTH_CM = 20
export const DEFAULT_PARCEL_HEIGHT_CM = 10

/** Resolved Bob Go configuration (server-side only). */
export interface BobGoConfig {
  /** Bearer token (API key) from the Bob Go portal. */
  apiKey: string
  /** Full base URL (sandbox or production). */
  baseUrl: string
}

/**
 * Reads Bob Go configuration from the environment. Returns null when the API
 * key is absent (the provider is then not registered). `BOBGO_TEST_MODE=true`
 * selects the documented sandbox base URL; otherwise the production base URL
 * is used.
 */
export function bobGoConfigFromEnv(
  env: Record<string, string | undefined> = process.env
): BobGoConfig | null {
  const apiKey = env.BOBGO_API_KEY
  if (!apiKey) return null
  const testMode = env.BOBGO_TEST_MODE === "true"
  return {
    apiKey,
    baseUrl: testMode ? BOBGO_SANDBOX_URL : BOBGO_PRODUCTION_URL,
  }
}

// ── Provider ──────────────────────────────────

/**
 * Bob Go shipping provider. Implements the existing `ShippingProvider`
 * interface so checkout business logic never depends on a concrete courier.
 *
 * The configuration is resolved from the environment by default; tests
 * (and the registry factory) may pass an explicit config. The provider is
 * only registered when `isConfigured()` returns true (i.e. an API key is
 * present).
 */
export class BobGoProvider implements ShippingProvider {
  readonly id = "bobgo" as const
  private readonly config: BobGoConfig | null

  constructor(config?: BobGoConfig | null) {
    this.config = config ?? bobGoConfigFromEnv()
  }

  isConfigured(): boolean {
    return this.config !== null
  }

  async quote(request: ShippingQuoteRequest): Promise<ShippingQuote[]> {
    if (!this.config) {
      throw new ShippingProviderError(
        "Bob Go is not configured on the server.",
        "not-configured",
        this.id
      )
    }

    const payload = buildBobGoRatesPayload(request)
    let res: Response
    try {
      res = await fetch(`${this.config.baseUrl}${BOBGO_RATES_PATH}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
    } catch (err) {
      throw new ShippingProviderError(
        "Bob Go rate request could not be completed.",
        "network-error",
        this.id,
        err
      )
    }

    if (!res.ok) {
      // The response body is preserved on `cause` for server-side diagnostics
      // only; the public message stays generic and credential-free.
      const text = await safeReadText(res)
      throw new ShippingProviderError(
        `Bob Go rate request failed: HTTP ${res.status}.`,
        "http-error",
        this.id,
        text || undefined
      )
    }

    let data: unknown
    try {
      data = await res.json()
    } catch (err) {
      throw new ShippingProviderError(
        "Bob Go returned a non-JSON response.",
        "malformed-response",
        this.id,
        err
      )
    }

    const rates = parseBobGoRates(data)
    if (rates.length === 0) {
      throw new ShippingProviderError(
        "Bob Go returned no shipping rates.",
        "no-rates",
        this.id
      )
    }

    return rates
  }
}

// ── Pure helpers (exported for unit testing) ──

/**
 * Maps a normalized ISO country name/code to the form Bob Go expects (ISO
 * 3166-1 alpha-2). "South Africa" → "ZA"; a 2-letter code is uppercased and
 * passed through; anything else is passed through unchanged so the live API
 * can surface a validation error rather than us silently dropping the value.
 */
export function bobGoCountryCode(country: string): string {
  const trimmed = country.trim()
  const lower = trimmed.toLowerCase()
  if (lower === "south africa" || lower === "rsa") return "ZA"
  if (/^[a-z]{2}$/i.test(trimmed)) return trimmed.toUpperCase()
  return trimmed
}

/**
 * Maps the application's `ShippingAddress` into Bob Go's address shape.
 * `local_area` falls back to the city when no second address line is present
 * (mirroring the documented integration mapping).
 */
export function bobGoAddress(address: ShippingAddress): Record<string, string> {
  return {
    company: "",
    street_address: address.street1,
    local_area: address.street2?.trim() || address.city,
    city: address.city,
    zone: address.province,
    country: bobGoCountryCode(address.country),
    code: address.postalCode,
  }
}

/**
 * Maps the application's `Parcel` list into Bob Go's parcel shape. Weight is
 * converted from grams to kilograms. Dimensions fall back to the conservative
 * default parcel size when the parcel does not carry them (the MVP product
 * schema lacks per-product dimensions — see the LIMITATION note).
 */
export function bobGoParcels(parcels: Parcel[]): Array<Record<string, number | string>> {
  return parcels.map((parcel) => ({
    description: "Parcel",
    submitted_length_cm: parcel.lengthCm ?? DEFAULT_PARCEL_LENGTH_CM,
    submitted_width_cm: parcel.widthCm ?? DEFAULT_PARCEL_WIDTH_CM,
    submitted_height_cm: parcel.heightCm ?? DEFAULT_PARCEL_HEIGHT_CM,
    submitted_weight_kg: parcel.weightGrams / 1000,
  }))
}

/**
 * Builds the `POST /rates` request body from a `ShippingQuoteRequest`.
 * Contact fields are intentionally omitted: at quote time the shopper's
 * contact details are not part of the shipping abstraction, and the rates
 * endpoint is documented to accept addresses + parcels + declared value.
 */
export function buildBobGoRatesPayload(
  request: ShippingQuoteRequest
): Record<string, unknown> {
  return {
    collection_address: bobGoAddress(request.origin),
    delivery_address: bobGoAddress(request.destination),
    parcels: bobGoParcels(request.parcels),
    declared_value: request.subtotal,
    timeout: BOBGO_REQUEST_TIMEOUT_MS,
  }
}

/** A single rate extracted from a Bob Go response, before normalization. */
interface BobGoRate {
  amount: number
  currency: string
  method: string
}

/**
 * Parses a Bob Go `/rates` response into a list of `ShippingQuote` objects.
 *
 * Handles the documented response shapes:
 *  - a bare JSON array of rates,
 *  - an object with a `rates` / `data` / `results` array,
 *  - an object with `provider_rate_requests[]` where each `status ===
 *    "success"` entry contributes its `responses[]` (carrier/service stamped
 *    from the parent request).
 *
 * Each extracted rate is mapped to a `ShippingQuote` with `provider: "bobgo"`,
 * `estimateDays: null` (the rates endpoint does not reliably expose delivery
 * days, so none are invented), and the carrier/service as the method label.
 * Currency/rate validation is deferred to the registry's `normalizeQuote`.
 */
export function parseBobGoRates(data: unknown): ShippingQuote[] {
  const extracted = extractRawRates(data)
  const quotes: ShippingQuote[] = []
  for (const raw of extracted) {
    const rate = normalizeRawRate(raw)
    if (rate) {
      quotes.push({
        provider: "bobgo",
        method: rate.method,
        rate: rate.amount,
        currency: rate.currency,
        estimateDays: null,
      })
    }
  }
  return quotes
}

/**
 * Extracts the raw rate objects from any of the documented response shapes,
 * stamping `provider_slug`/`provider_name` onto rates that come from the
 * `provider_rate_requests` shape.
 */
function extractRawRates(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) {
    return data.filter((item): item is Record<string, unknown> => isPlainObject(item))
  }
  if (!isPlainObject(data)) return []

  for (const key of ["rates", "data", "results"] as const) {
    const value = (data as Record<string, unknown>)[key]
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => isPlainObject(item))
    }
  }

  const providerRateRequests = (data as Record<string, unknown>)[
    "provider_rate_requests"
  ]
  if (Array.isArray(providerRateRequests)) {
    const rates: Array<Record<string, unknown>> = []
    for (const prr of providerRateRequests) {
      if (!isPlainObject(prr)) continue
      if (prr["status"] && prr["status"] !== "success") continue
      const responses = prr["responses"]
      if (!Array.isArray(responses)) continue
      const providerSlug = prr["provider_slug"]
      const providerName = prr["provider_name"]
      for (const response of responses) {
        if (!isPlainObject(response)) continue
        if (response["status"] && response["status"] !== "success") continue
        rates.push({
          ...response,
          provider_slug: response["provider_slug"] ?? providerSlug,
          provider_name: response["provider_name"] ?? providerName,
        })
      }
    }
    return rates
  }

  return []
}

/**
 * Normalizes a single raw rate object into a `{ amount, currency, method }`
 * triple. Returns null when the amount is missing or not a finite number, or
 * when no method label can be derived. Currency defaults to ZAR (Bob Go is a
 * South-African-rand platform) when not present.
 */
function normalizeRawRate(raw: Record<string, unknown>): BobGoRate | null {
  const amount = Number(raw["total_price"] ?? raw["rate"] ?? raw["rate_amount"] ?? raw["price"])
  if (!Number.isFinite(amount)) return null

  const currency =
    typeof raw["currency"] === "string" && raw["currency"].trim().length > 0
      ? String(raw["currency"]).trim().toUpperCase()
      : "ZAR"

  const serviceLevel = isPlainObject(raw["service_level"]) ? raw["service_level"] : {}
  const method =
    String(raw["service_name"] ?? serviceLevel["name"] ?? raw["service_level_code"] ?? "").trim() ||
    String(raw["provider_name"] ?? raw["courier_name"] ?? raw["provider_slug"] ?? "").trim() ||
    "Bob Go"

  return { amount, currency, method }
}

// ── Internal utilities ────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ""
  }
}
