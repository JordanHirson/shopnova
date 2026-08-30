/**
 * ShopNova - Shipping provider registry.
 *
 * Keeps courier implementations decoupled from checkout business logic,
 * mirroring the payment provider registry. Providers are constructed with
 * their server-side configuration so an unconfigured courier is simply not
 * registered and can never be selected.
 *
 * PROVIDER STRATEGY (per GUIDEBOOK.md):
 * - The guidebook identifies Bob Go, Aramex, PUDO, and The Courier Guy as
 *   the intended couriers and fetches quotes from all of them in parallel.
 * - When one or more live couriers are configured, ONLY those live couriers
 *   are queried. The deterministic MVP provider is NOT used as a silent
 *   fallback — a failed live quote must never be replaced with an arbitrary
 *   unverified price. If every configured live courier fails, checkout
 *   fails with a safe, user-facing error.
 * - When NO live courier is configured, the deterministic `MvpShippingProvider`
 *   is used. This is the documented deliberate fallback that preserves the
 *   existing MVP shipping behavior exactly.
 *
 * LIVE COURIER STATUS:
 * No live courier adapter is implemented yet — official API contracts and
 * credentials are not available in this environment, and the guidebook
 * forbids inventing API endpoints/auth/response shapes. The abstraction and
 * registry are production-ready; adding a courier is a one-line registration
 * in `LIVE_COURIER_FACTORIES` once its adapter + server-side credentials
 * exist. See `.env.example` for the intended credential variables.
 */
import "server-only"

import type {
  ShippingAddress,
  ShippingProvider,
  ShippingQuote,
  ShippingQuoteRequest,
} from "./shipping-provider"
import { MvpShippingProvider } from "./shipping-provider.ts"
import { normalizeQuote, selectCheapestQuote } from "./shipping-logic.ts"

// ── Origin configuration ──────────────────────

/** Environment variable names for the store's dispatch (origin) address. */
export const SHIPPING_ORIGIN_ENV = {
  street: "SHIPPING_ORIGIN_STREET",
  city: "SHIPPING_ORIGIN_CITY",
  province: "SHIPPING_ORIGIN_PROVINCE",
  postalCode: "SHIPPING_ORIGIN_POSTAL_CODE",
  country: "SHIPPING_ORIGIN_COUNTRY",
} as const

/** Default origin (a Cape Town dispatch point) used when env vars are unset. */
const DEFAULT_ORIGIN: ShippingAddress = {
  street1: "",
  city: "Cape Town",
  province: "Western Cape",
  postalCode: "8001",
  country: "South Africa",
}

/**
 * Returns the store's shipping origin address, read from environment
 * variables with sensible SA defaults. Used as the origin for every quote.
 */
export function getShippingOrigin(
  env: Record<string, string | undefined> = process.env
): ShippingAddress {
  return {
    street1: (env[SHIPPING_ORIGIN_ENV.street] ?? DEFAULT_ORIGIN.street1).trim(),
    city: (env[SHIPPING_ORIGIN_ENV.city] ?? DEFAULT_ORIGIN.city).trim(),
    province:
      (env[SHIPPING_ORIGIN_ENV.province] ?? DEFAULT_ORIGIN.province).trim(),
    postalCode:
      (env[SHIPPING_ORIGIN_ENV.postalCode] ?? DEFAULT_ORIGIN.postalCode).trim(),
    country:
      (env[SHIPPING_ORIGIN_ENV.country] ?? DEFAULT_ORIGIN.country).trim(),
  }
}

// ── Live courier registration ─────────────────

/**
 * Factories that build configured live courier providers, or null when the
 * courier's server-side credentials are absent. Each entry is tried at
 * registry build time; only providers that return a configured instance are
 * registered.
 *
 * To add a live courier, implement a `ShippingProvider` adapter in its own
 * module (e.g. `features/shipping/couriers/bobgo.ts`) that reads its
 * server-only credentials and returns null from `isConfigured()` when they
 * are missing, then add a factory here:
 *
 *   () => new BobGoProvider(),
 */
const LIVE_COURIER_FACTORIES: Array<() => ShippingProvider | null> = [
  // () => new BobGoProvider(),
  // () => new AramexProvider(),
  // () => new PudoProvider(),
  // () => new CourierGuyProvider(),
]

/**
 * Pure, testable selection of providers from a list of courier factories.
 *
 * - If any live courier is configured, only live couriers are returned
 *   (the MVP provider is intentionally excluded so a failed live quote can
 *   never silently fall back to an arbitrary price).
 * - If no live courier is configured, the deterministic MVP provider is
 *   returned (the documented deliberate fallback).
 */
export function selectProvidersFromFactories(
  factories: Array<() => ShippingProvider | null>
): ShippingProvider[] {
  const live: ShippingProvider[] = []
  for (const factory of factories) {
    const provider = factory()
    if (provider && provider.isConfigured()) {
      live.push(provider)
    }
  }

  if (live.length > 0) return live
  return [new MvpShippingProvider()]
}

/**
 * Builds the provider list available for the current server environment.
 */
export function getConfiguredShippingProviders(): ShippingProvider[] {
  return selectProvidersFromFactories(LIVE_COURIER_FACTORIES)
}

/** True when at least one live courier is configured (MVP fallback disabled). */
export function hasLiveCourierConfigured(): boolean {
  return getConfiguredShippingProviders().some((p) => p.id !== "mvp")
}

// ── Quote fan-out ─────────────────────────────

/**
 * Error raised when no valid shipping quote can be obtained. The message is
 * generic and credential-free; provider errors are preserved on `causes`
 * for server-side diagnostics. Checkout surfaces a safe user-facing error.
 */
export class ShippingQuoteError extends Error {
  readonly causes: ReadonlyArray<{ provider: string; error: unknown }>
  constructor(
    message: string,
    causes: ReadonlyArray<{ provider: string; error: unknown }> = []
  ) {
    super(message)
    this.name = "ShippingQuoteError"
    this.causes = causes
  }
}

/**
 * Pure, testable fan-out: fetches quotes from the given providers in
 * parallel (mirroring the guidebook's `Promise.allSettled` fan-out),
 * normalizes/validates each response, and returns the valid quotes.
 *
 * - Provider failures are collected but do not abort the fan-out; a
 *   successful quote from any provider is usable.
 * - If NO provider returns a valid quote, a `ShippingQuoteError` is thrown.
 *   Checkout MUST NOT fabricate a shipping price in that case.
 *
 * Every returned quote has been validated by `normalizeQuote` against the
 * request currency, so forged/malformed provider responses are discarded
 * before they can influence a financial calculation.
 */
export async function collectQuotesFromProviders(
  providers: ShippingProvider[],
  request: ShippingQuoteRequest
): Promise<ShippingQuote[]> {
  const settled = await Promise.allSettled(
    providers.map((provider) => provider.quote(request))
  )

  const validQuotes: ShippingQuote[] = []
  const failures: Array<{ provider: string; error: unknown }> = []

  settled.forEach((result, index) => {
    const provider = providers[index]
    if (result.status === "fulfilled") {
      for (const raw of result.value) {
        const normalized = normalizeQuote(raw, request.currency)
        if (normalized) validQuotes.push(normalized)
      }
    } else {
      // Preserve the driver error for server-side diagnostics only.
      failures.push({ provider: provider.id, error: result.reason })
    }
  })

  if (validQuotes.length === 0) {
    throw new ShippingQuoteError(
      "We could not get a shipping quote for this destination. " +
        "Please try again later or contact support.",
      failures
    )
  }

  return validQuotes
}

/**
 * Fetches quotes from every configured provider in parallel and returns the
 * valid quotes. See `collectQuotesFromProviders` for the testable core.
 */
export async function getShippingQuotes(
  request: ShippingQuoteRequest
): Promise<ShippingQuote[]> {
  return collectQuotesFromProviders(getConfiguredShippingProviders(), request)
}

/**
 * Obtains the authoritative shipping quote for a request and returns the
 * cheapest valid option. This is the single entry point checkout business
 * logic uses; it never touches a concrete courier.
 */
export async function getAuthoritativeShippingQuote(
  request: ShippingQuoteRequest
): Promise<ShippingQuote> {
  const quotes = await getShippingQuotes(request)
  const selected = selectCheapestQuote(quotes, request.currency)
  if (!selected) {
    throw new ShippingQuoteError(
      "No valid shipping quote was returned for this destination."
    )
  }
  return selected
}
