/**
 * ShopNova - Shipping provider abstraction.
 *
 * The guidebook specifies live courier quotes (Bob Go, Aramex, PUDO,
 * The Courier Guy) for the shipping step of checkout. This module defines
 * the provider-agnostic contract every courier adapter implements so that
 * checkout business logic never depends on a specific courier's API.
 *
 * DESIGN:
 * - The application depends on the `ShippingProvider` interface, never on a
 *   concrete courier. Provider-specific API details live inside adapters.
 * - `MvpShippingProvider` keeps the deterministic free-above-$50 / flat-$5
 *   rule from `features/checkout/checkout-logic.ts`. It is the documented
 *   deliberate fallback used when no live courier is configured.
 * - `FakeShippingProvider` is a deterministic, configurable provider for
 *   automated tests (no real courier credentials required).
 *
 * SECURITY:
 * - Quotes returned by a provider are NEVER trusted blindly. The pure
 *   `normalizeQuote` helper in `shipping-logic.ts` validates/coerces every
 *   field before a quote can influence a financial calculation.
 * - The client is never authoritative for the shipping rate; the server
 *   obtains the quote through this abstraction at the checkout boundary.
 */
import { calculateShipping } from "../checkout/checkout-logic.ts"

/** Courier provider identifiers known to the platform. */
export type ShippingProviderId =
  | "mvp"
  | "bobgo"
  | "aramex"
  | "pudo"
  | "courier-guy"

/** A postal address used for a shipping origin or destination. */
export interface ShippingAddress {
  street1: string
  street2?: string
  city: string
  /** State / province / region. */
  province: string
  postalCode: string
  /** Country name or ISO-3166 code. */
  country: string
}

/** A single parcel being shipped. Weight is in grams. */
export interface Parcel {
  weightGrams: number
  lengthCm?: number
  widthCm?: number
  heightCm?: number
}

/**
 * The request passed to a shipping provider to obtain quotes.
 * All amounts are in the request currency's major units (e.g. ZAR).
 */
export interface ShippingQuoteRequest {
  origin: ShippingAddress
  destination: ShippingAddress
  parcels: Parcel[]
  /** Order subtotal in major currency units (some providers apply free-shipping rules). */
  subtotal: number
  currency: string
}

/** A normalized, trusted shipping option quoted by a provider. */
export interface ShippingQuote {
  /** Provider id, e.g. "mvp" | "bobgo" | "aramex" | "pudo" | "courier-guy". */
  provider: ShippingProviderId
  /** Human-readable method name, e.g. "Standard shipping". */
  method: string
  /** Quoted rate in the request currency's major units. */
  rate: number
  currency: string
  /** Delivery estimate in business days (null = unknown). */
  estimateDays: number | null
}

/**
 * Error thrown by a shipping provider when a quote cannot be obtained.
 * The message is generic and credential-free; the original driver error is
 * preserved on `cause` for server-side diagnostics.
 */
export class ShippingProviderError extends Error {
  readonly code: string
  readonly provider: ShippingProviderId
  constructor(
    message: string,
    code: string,
    provider: ShippingProviderId,
    cause?: unknown
  ) {
    super(message)
    this.name = "ShippingProviderError"
    this.code = code
    this.provider = provider
    if (cause !== undefined) {
      // `cause` is a standard Error option; assign explicitly for older runtimes.
      ;(this as { cause?: unknown }).cause = cause
    }
  }
}

/** Contract every shipping provider (live or deterministic) implements. */
export interface ShippingProvider {
  readonly id: ShippingProviderId
  /** True when this provider's server-side configuration is complete enough to use. */
  isConfigured(): boolean
  /** Returns one or more shipping quotes for the request. */
  quote(request: ShippingQuoteRequest): Promise<ShippingQuote[]>
}

/**
 * Default MVP provider: keeps the deterministic free-above-$50 / flat-$5
 * rule from checkout-logic. Live couriers later implement the same
 * interface and are registered in `provider-registry.ts`.
 *
 * This provider is always "configured" — it is the documented deliberate
 * fallback when no live courier is available (see provider-registry.ts).
 */
export class MvpShippingProvider implements ShippingProvider {
  readonly id = "mvp" as const

  isConfigured(): boolean {
    return true
  }

  async quote(request: ShippingQuoteRequest): Promise<ShippingQuote[]> {
    const rate = calculateShipping(request.subtotal)
    return [
      {
        provider: this.id,
        method: rate === 0 ? "Free shipping" : "Standard shipping",
        rate,
        currency: request.currency,
        estimateDays: rate === 0 ? null : 5,
      },
    ]
  }
}

/**
 * Deterministic, configurable fake provider for automated tests. Never
 * registered in production. Can simulate success (fixed rate), a list of
 * quotes, or failure (throws `ShippingProviderError`).
 */
export class FakeShippingProvider implements ShippingProvider {
  readonly id: ShippingProviderId
  private readonly quotes: ShippingQuote[] | (() => ShippingQuote[])
  private readonly fail: boolean
  private readonly configured: boolean

  constructor(options: {
    id: ShippingProviderId
    quotes?: ShippingQuote[]
    quoteFactory?: () => ShippingQuote[]
    fail?: boolean
    configured?: boolean
  }) {
    this.id = options.id
    if (options.quotes && options.quoteFactory) {
      throw new Error("Provide either quotes or quoteFactory, not both.")
    }
    this.quotes = options.quotes ?? options.quoteFactory ?? []
    this.fail = options.fail ?? false
    this.configured = options.configured ?? true
  }

  isConfigured(): boolean {
    return this.configured
  }

  async quote(request: ShippingQuoteRequest): Promise<ShippingQuote[]> {
    if (this.fail) {
      throw new ShippingProviderError(
        "Fake provider is configured to fail.",
        "fake-failure",
        this.id
      )
    }
    if (typeof this.quotes === "function") {
      return this.quotes()
    }
    // Stamp the request currency onto fixed quotes so tests can assert totals.
    return this.quotes.map((q) => ({ ...q, currency: request.currency }))
  }
}
