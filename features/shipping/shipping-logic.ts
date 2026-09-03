/**
 * ShopNova - Shipping business logic (pure functions).
 *
 * Intentionally dependency-free so it can be unit tested with Node's native
 * test runner and reused by server actions, the order service, and the
 * provider registry. All money math is done in integer cents to avoid
 * floating-point drift.
 *
 * SECURITY:
 * - Provider responses are NEVER trusted blindly. `normalizeQuote` validates
 *   and coerces every field before a quote can influence a financial total.
 * - The client is never authoritative for the shipping rate; these helpers
 *   operate on server-obtained quotes only.
 */
import type {
  Parcel,
  ShippingAddress,
  ShippingProviderId,
  ShippingQuote,
  ShippingQuoteRequest,
} from "./shipping-provider"

/** Default currency used when none is supplied. */
export const DEFAULT_SHIPPING_CURRENCY = "ZAR"

/** Default parcel weight (grams) used when product weights are unavailable. */
export const DEFAULT_PARCEL_WEIGHT_GRAMS = 1000

// ── Address helpers ───────────────────────────

/** Checkout form fields that describe a shipping destination. */
export interface CheckoutDestination {
  shippingAddress: string
  city: string
  province: string
  postalCode: string
  country: string
}

/**
 * Returns true when every required destination field is present and
 * non-empty. Used to decide whether a real quote can be requested. Acts as
 * a type guard so callers can safely build a `ShippingAddress` afterwards.
 */
export function isShippingDestinationComplete(
  dest: Partial<CheckoutDestination>
): dest is CheckoutDestination {
  return Boolean(
    dest.shippingAddress?.trim() &&
      dest.city?.trim() &&
      dest.province?.trim() &&
      dest.postalCode?.trim() &&
      dest.country?.trim()
  )
}

/**
 * Maps the application's checkout destination into the common internal
 * `ShippingAddress`. Provider-specific mapping happens inside each adapter;
 * the application only ever deals with this normalized shape.
 */
export function shippingAddressFromDestination(
  dest: CheckoutDestination
): ShippingAddress {
  return {
    street1: dest.shippingAddress.trim(),
    city: dest.city.trim(),
    province: dest.province.trim(),
    postalCode: dest.postalCode.trim(),
    country: dest.country.trim(),
  }
}

// ── Parcel helpers ────────────────────────────

/**
 * Builds a default parcel list from a total item count. The MVP product
 * schema does not carry per-variant weights, so a conservative default
 * weight is used per item. Live courier adapters that require accurate
 * weights will need product weights (a post-MVP schema addition).
 */
export function parcelsFromItemCount(itemCount: number): Parcel[] {
  const count = Math.max(1, Math.floor(itemCount))
  return Array.from({ length: count }, () => ({
    weightGrams: DEFAULT_PARCEL_WEIGHT_GRAMS,
  }))
}

/**
 * Physical characteristics of a single checkout line, used to build accurate
 * shipping parcels. All fields are optional; missing/zero values fall back to
 * the documented conservative defaults (see `parcelsFromLines`).
 */
export interface CheckoutLinePhysical {
  quantity: number
  weightGrams?: number | null
  lengthCm?: number | null
  widthCm?: number | null
  heightCm?: number | null
}

/**
 * Returns true when a physical value is "specified": a finite number strictly
 * greater than zero. Null, undefined, zero, and non-finite values are treated
 * as "not specified" so the shipping layer falls back to defaults. Zero is
 * deliberately treated as missing because a zero physical measurement is not
 * a meaningful shipping input (Bob Go requires dimensions >= 1 cm and a
 * positive weight).
 */
function isSpecified(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

/**
 * Builds the parcel list for a shipping quote from the cart's checkout lines.
 *
 * QUANTITY HANDLING:
 * Each purchased unit is represented as ONE parcel carrying that product's
 * own physical measurements. Purchasing quantity 3 of a product therefore
 * produces 3 parcels — each with the product's weight and dimensions — NOT a
 * single parcel with multiplied dimensions (multiplying dimensions would be
 * physically incorrect). This matches the existing `parcelsFromItemCount`
 * convention (one parcel per item) and the Bob Go `parcels` array contract.
 *
 * FALLBACK BEHAVIOR (deterministic, backward compatible):
 * - Weight: when a product has no positive `weightGrams`, the parcel uses the
 *   documented `DEFAULT_PARCEL_WEIGHT_GRAMS` (1 kg).
 * - Dimensions: when a product has no positive dimension, the parcel omits it
 *   (`undefined`), so each courier adapter applies its own documented default
 *   (Bob Go uses `DEFAULT_PARCEL_*_CM` — see couriers/bobgo.ts).
 * - A product with partial data (e.g. weight but no dimensions) keeps the
 *   supplied field and falls back per-field for the missing ones.
 * - Products with NO physical metadata produce parcels identical to the
 *   pre-existing `parcelsFromItemCount` behaviour, so existing products
 *   continue to receive quotes exactly as before.
 */
export function parcelsFromLines(lines: CheckoutLinePhysical[]): Parcel[] {
  const parcels: Parcel[] = []
  for (const line of lines) {
    const quantity = Math.max(1, Math.floor(line.quantity))
    for (let i = 0; i < quantity; i++) {
      parcels.push({
        weightGrams: isSpecified(line.weightGrams)
          ? line.weightGrams
          : DEFAULT_PARCEL_WEIGHT_GRAMS,
        lengthCm: isSpecified(line.lengthCm) ? line.lengthCm : undefined,
        widthCm: isSpecified(line.widthCm) ? line.widthCm : undefined,
        heightCm: isSpecified(line.heightCm) ? line.heightCm : undefined,
      })
    }
  }
  // Guarantee at least one parcel so a quote request is always well-formed.
  return parcels.length > 0 ? parcels : parcelsFromItemCount(1)
}

// ── Quote request building ────────────────────

/**
 * Assembles a `ShippingQuoteRequest` from the common inputs available at
 * checkout. The origin is the store's dispatch address; the destination is
 * the shopper's shipping address; parcels are derived from the cart.
 *
 * When `lines` (per-line physical data) is supplied, parcels are built from
 * the actual product weight/dimensions via `parcelsFromLines` (one parcel per
 * unit, with per-field fallback for missing data). When `lines` is omitted,
 * the legacy `parcelsFromItemCount(itemCount)` behaviour is used so existing
 * callers and tests remain unchanged.
 */
export function buildQuoteRequest(input: {
  origin: ShippingAddress
  destination: ShippingAddress
  subtotal: number
  currency?: string
  itemCount: number
  /** Optional per-line physical data for accurate parcel building. */
  lines?: CheckoutLinePhysical[]
}): ShippingQuoteRequest {
  return {
    origin: input.origin,
    destination: input.destination,
    parcels: input.lines
      ? parcelsFromLines(input.lines)
      : parcelsFromItemCount(input.itemCount),
    subtotal: input.subtotal,
    currency: input.currency ?? DEFAULT_SHIPPING_CURRENCY,
  }
}

// ── Quote validation / normalization ──────────

const KNOWN_PROVIDERS: readonly ShippingProviderId[] = [
  "mvp",
  "bobgo",
  "aramex",
  "pudo",
  "courier-guy",
]

function isKnownProvider(value: unknown): value is ShippingProviderId {
  return (
    typeof value === "string" &&
    (KNOWN_PROVIDERS as readonly string[]).includes(value)
  )
}

function toCents(amount: number): number {
  return Math.round(amount * 100)
}

/**
 * Validates and normalizes a raw quote (e.g. parsed from a provider API
 * response) into a trusted `ShippingQuote`. Returns null when the quote is
 * malformed, has an unknown provider, a non-finite/negative rate, or a
 * currency that does not match the request.
 *
 * This is the defensive boundary that prevents a forged or malformed
 * provider response from influencing a financial calculation.
 */
export function normalizeQuote(
  raw: unknown,
  expectedCurrency: string
): ShippingQuote | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>

  if (!isKnownProvider(r.provider)) return null

  const method = typeof r.method === "string" ? r.method.trim() : ""
  if (method.length === 0 || method.length > 120) return null

  const rate = Number(r.rate)
  if (!Number.isFinite(rate) || rate < 0) return null

  const currency =
    typeof r.currency === "string" ? r.currency.trim().toUpperCase() : ""
  if (currency.length === 0) return null
  if (currency !== expectedCurrency.trim().toUpperCase()) return null

  const estimateDays =
    r.estimateDays === null ||
    r.estimateDays === undefined ||
    (typeof r.estimateDays === "number" && Number.isFinite(r.estimateDays) && r.estimateDays >= 0)
      ? ((r.estimateDays as number | null | undefined) ?? null)
      : null

  return {
    provider: r.provider,
    method,
    rate,
    currency,
    estimateDays,
  }
}

/** True when a quote object is already a trusted, normalized `ShippingQuote`. */
export function isValidQuote(
  quote: ShippingQuote,
  expectedCurrency: string
): boolean {
  return normalizeQuote(quote, expectedCurrency) !== null
}

// ── Quote selection ───────────────────────────

/**
 * Selects the cheapest valid quote (lowest rate). Ties are broken by
 * provider id for deterministic ordering. Returns null when no valid quote
 * is available. Comparison is done in cents to avoid float drift.
 */
export function selectCheapestQuote(
  quotes: ShippingQuote[],
  expectedCurrency: string
): ShippingQuote | null {
  const valid = quotes.filter((q) => isValidQuote(q, expectedCurrency))
  if (valid.length === 0) return null

  return valid.reduce((best, current) => {
    if (toCents(current.rate) < toCents(best.rate)) return current
    if (toCents(current.rate) === toCents(best.rate)) {
      return current.provider < best.provider ? current : best
    }
    return best
  })
}

// ── Snapshot type ─────────────────────────────

/**
 * The shipping snapshot persisted on a CheckoutIntent so the order created
 * after a verified payment reproduces exactly what was quoted and charged.
 * Stored as JSON; re-read and re-validated at order creation time.
 */
export interface ShippingQuoteSnapshot {
  provider: ShippingProviderId
  method: string
  rate: number
  currency: string
  estimateDays: number | null
}

/** Converts a trusted `ShippingQuote` into the persisted snapshot shape. */
export function quoteToSnapshot(
  quote: ShippingQuote
): ShippingQuoteSnapshot {
  return {
    provider: quote.provider,
    method: quote.method,
    rate: quote.rate,
    currency: quote.currency,
    estimateDays: quote.estimateDays,
  }
}

/**
 * Re-validates a persisted snapshot and returns the trusted shipping rate,
 * or null when the snapshot is missing/invalid (e.g. a legacy intent
 * created before shipping snapshots existed). The caller is expected to
 * fall back to the deterministic MVP rule in that case.
 */
export function snapshotToRate(
  snapshot: unknown,
  expectedCurrency: string
): ShippingQuoteSnapshot | null {
  const normalized = normalizeQuote(snapshot, expectedCurrency)
  if (!normalized) return null
  return quoteToSnapshot(normalized)
}
