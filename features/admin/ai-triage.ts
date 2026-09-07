/**
 * ShopNova - AI Order Triage (Demo Step 5).
 *
 * Server-side triage that mirrors the GUIDEBOOK's "AI Order Triage Agent"
 * (§11): it analyses an order for fraud risk, stock availability, and
 * fulfillability (weight & dimensions), then recommends the cheapest courier
 * via the existing shipping provider abstraction (Bob Go when configured).
 *
 * DESIGN:
 * - Reuses the existing shipping registry (`getShippingQuotes`,
 *   `selectCheapestQuote`) so the recommendation flows through the same
 *   defensive `normalizeQuote` boundary as checkout — provider responses are
 *   never trusted blindly.
 * - When no live courier is configured (the common demo case), a deterministic
 *   simulated recommendation is returned so Demo Step 5 works end-to-end
 *   without API keys. The simulation is clearly labelled via `simulated: true`
 *   and matches the documented demo values (The Courier Guy via Bob Go,
 *   R85.00, ~48h).
 * - Fraud risk is derived deterministically from order characteristics (paid
 *   status, grand total). The schema does not yet carry a persisted risk
 *   score, so a conservative heuristic is used; this keeps the demo honest
 *   while leaving room for a real risk model later.
 *
 * SECURITY:
 * - Server-only. The triage never trusts client input; it re-loads order data
 *   from the persisted order record passed in by the caller (which itself was
 *   loaded behind `requireAdmin()`).
 */
import "server-only"

import type { ShippingQuote } from "@/features/shipping/shipping-provider"
import {
  buildQuoteRequest,
  selectCheapestQuote,
  type CheckoutLinePhysical,
} from "@/features/shipping/shipping-logic"
import {
  getShippingOrigin,
  getShippingQuotes,
  hasLiveCourierConfigured,
} from "@/features/shipping/provider-registry"

/** The shape of an order line as loaded by `getOrderForAdmin`. */
export interface TriageOrderLine {
  quantity: number
  product: {
    weightGrams: number | null
    lengthCm: number | null
    widthCm: number | null
    heightCm: number | null
    inventory: { quantity: number } | null
  }
}

/** The subset of an order needed for triage (decoupled from the Prisma type). */
export interface TriageOrder {
  orderNumber: string
  currency: string
  /** Order subtotal in major currency units (e.g. ZAR). */
  subtotal: number
  shippingCity: string
  shippingProvince: string
  shippingPostalCode: string
  shippingCountry: string
  shippingAddress: string
  isPaid: boolean
  items: TriageOrderLine[]
}

/** Fraud risk classification returned by the triage. */
export interface FraudRisk {
  level: "Low" | "Medium" | "High"
  score: number // 0–100, higher is safer
}

/** Stock verification result for the whole order. */
export interface StockVerification {
  status: "In Stock" | "Low Stock" | "Out of Stock"
  /** Per-line detail (used for transparency in the UI). */
  lines: Array<{
    available: number
    required: number
    ok: boolean
  }>
}

/** Auto-calculated physical characteristics for the shipment. */
export interface WeightAndDimensions {
  totalWeightGrams: number
  /** Representative single-parcel dimensions (cm). Falls back to defaults. */
  lengthCm: number
  widthCm: number
  heightCm: number
  /** True when every line carried real product dimensions. */
  fullySpecified: boolean
}

/** Courier recommendation produced by the triage. */
export interface CourierRecommendation {
  /** Display label, e.g. "The Courier Guy (via Bob Go)". */
  label: string
  /** Quoted rate in the order currency's major units. */
  rate: number
  currency: string
  /** Estimated delivery in hours (demo-facing unit). */
  estimateHours: number
  /** True when the quote came from the deterministic demo simulation. */
  simulated: boolean
}

/** Full triage result rendered by the AI Operations Copilot card. */
export interface OrderTriage {
  fraudRisk: FraudRisk
  stock: StockVerification
  physical: WeightAndDimensions
  recommendation: CourierRecommendation
}

// ── Defaults / simulation constants ───────────

/**
 * Deterministic simulated recommendation used when no live courier is
 * configured. Matches the Demo Step 5 script values (The Courier Guy via
 * Bob Go, R85.00, ~48h) so the demo is reproducible without API keys.
 */
const SIMULATED_RECOMMENDATION: CourierRecommendation = {
  label: "The Courier Guy (via Bob Go)",
  rate: 85,
  currency: "ZAR",
  estimateHours: 48,
  simulated: true,
}

/** Conservative default parcel dimensions (cm) — mirrors bobgo.ts defaults. */
const DEFAULT_PARCEL_LENGTH_CM = 30
const DEFAULT_PARCEL_WIDTH_CM = 20
const DEFAULT_PARCEL_HEIGHT_CM = 10
const DEFAULT_PARCEL_WEIGHT_GRAMS = 1000

// ── Pure helpers ──────────────────────────────

function isSpecified(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

/**
 * Computes a deterministic fraud-risk score from order characteristics.
 * The schema does not yet persist a risk score, so a conservative heuristic
 * is used: a paid, modest-value order is Low risk; very high value or unpaid
 * orders are escalated. The score is the safety score (higher = safer),
 * matching the demo's "98/100" framing.
 */
export function assessFraudRisk(order: TriageOrder): FraudRisk {
  if (!order.isPaid) {
    return { level: "Medium", score: 60 }
  }
  if (order.subtotal > 5000) {
    return { level: "Medium", score: 72 }
  }
  return { level: "Low", score: 98 }
}

/**
 * Verifies stock across all order lines against the persisted inventory
 * quantities. Lines without an inventory record are treated as fulfilable
 * (the product may be a non-tracked / federated item) so triage never blocks
 * a legitimate order on missing metadata.
 */
export function verifyStock(order: TriageOrder): StockVerification {
  const lines = order.items.map((item) => {
    const required = Math.max(1, Math.floor(item.quantity))
    const available = item.product.inventory?.quantity ?? required
    return { available, required, ok: available >= required }
  })

  const allOk = lines.every((l) => l.ok)
  const anyStock = lines.some((l) => l.available > 0)

  let status: StockVerification["status"]
  if (allOk) {
    status = "In Stock"
  } else if (anyStock) {
    status = "Low Stock"
  } else {
    status = "Out of Stock"
  }

  return { status, lines }
}

/**
 * Auto-calculates the shipment's physical characteristics from the order
 * lines. Weight is summed across units; dimensions fall back to the
 * documented conservative defaults per-field when a product lacks them.
 */
export function calculateWeightAndDimensions(
  order: TriageOrder
): WeightAndDimensions {
  let totalWeightGrams = 0
  let fullySpecified = order.items.length > 0
  let maxLength = 0
  let maxWidth = 0
  let maxHeight = 0

  for (const item of order.items) {
    const quantity = Math.max(1, Math.floor(item.quantity))
    const weight = isSpecified(item.product.weightGrams)
      ? item.product.weightGrams
      : DEFAULT_PARCEL_WEIGHT_GRAMS
    totalWeightGrams += weight * quantity

    const length = isSpecified(item.product.lengthCm) ? item.product.lengthCm : 0
    const width = isSpecified(item.product.widthCm) ? item.product.widthCm : 0
    const height = isSpecified(item.product.heightCm) ? item.product.heightCm : 0

    if (length > maxLength) maxLength = length
    if (width > maxWidth) maxWidth = width
    if (height > maxHeight) maxHeight = height

    if (
      !isSpecified(item.product.lengthCm) ||
      !isSpecified(item.product.widthCm) ||
      !isSpecified(item.product.heightCm)
    ) {
      fullySpecified = false
    }
  }

  return {
    totalWeightGrams: totalWeightGrams || DEFAULT_PARCEL_WEIGHT_GRAMS,
    lengthCm: maxLength || DEFAULT_PARCEL_LENGTH_CM,
    widthCm: maxWidth || DEFAULT_PARCEL_WIDTH_CM,
    heightCm: maxHeight || DEFAULT_PARCEL_HEIGHT_CM,
    fullySpecified,
  }
}

/**
 * Builds the shipping quote request for an order using the store's dispatch
 * origin and the order's shipping destination. Reuses `buildQuoteRequest` so
 * parcel construction stays consistent with checkout.
 */
function buildOrderQuoteRequest(order: TriageOrder) {
  const lines: CheckoutLinePhysical[] = order.items.map((item) => ({
    quantity: item.quantity,
    weightGrams: item.product.weightGrams,
    lengthCm: item.product.lengthCm,
    widthCm: item.product.widthCm,
    heightCm: item.product.heightCm,
  }))

  return buildQuoteRequest({
    origin: getShippingOrigin(),
    destination: {
      street1: order.shippingAddress,
      city: order.shippingCity,
      province: order.shippingProvince,
      postalCode: order.shippingPostalCode,
      country: order.shippingCountry,
    },
    subtotal: order.subtotal,
    currency: order.currency,
    itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
    lines,
  })
}

/**
 * Maps a normalized `ShippingQuote` (from the live registry) into the
 * demo-facing recommendation label. Bob Go aggregates multiple couriers, so
 * the carrier name is surfaced when present in the method label.
 */
function recommendationFromQuote(
  quote: ShippingQuote,
  estimateHours: number
): CourierRecommendation {
  // Bob Go method labels already carry the carrier (e.g. "The Courier Guy
  // · Road"). Normalise into the demo's "Carrier (via Bob Go)" framing.
  const carrier = quote.method.split(/[·-]/)[0]?.trim() || quote.method
  const via = quote.provider === "bobgo" ? " (via Bob Go)" : ""
  return {
    label: `${carrier}${via}`,
    rate: quote.rate,
    currency: quote.currency,
    estimateHours,
    simulated: false,
  }
}

/**
 * Derives an estimated delivery time (hours) from a quote's `estimateDays`.
 * Returns the demo default (48h) when the provider did not expose a delivery
 * estimate (Bob Go's /rates endpoint does not reliably return one).
 */
function estimateHoursFromQuote(quote: ShippingQuote): number {
  if (quote.estimateDays && quote.estimateDays > 0) {
    return quote.estimateDays * 24
  }
  return SIMULATED_RECOMMENDATION.estimateHours
}

/**
 * Recommends the cheapest courier for an order. Queries the live shipping
 * registry (Bob Go when configured) and selects the cheapest valid quote via
 * the existing `selectCheapestQuote` defensive boundary. When no live courier
 * is configured, returns the deterministic simulated recommendation so Demo
 * Step 5 is reproducible without API keys.
 */
export async function recommendCourier(
  order: TriageOrder
): Promise<CourierRecommendation> {
  if (!hasLiveCourierConfigured()) {
    return { ...SIMULATED_RECOMMENDATION, currency: order.currency || "ZAR" }
  }

  try {
    const quotes = await getShippingQuotes(buildOrderQuoteRequest(order))
    const cheapest = selectCheapestQuote(quotes, order.currency)
    if (!cheapest) return { ...SIMULATED_RECOMMENDATION, currency: order.currency || "ZAR" }
    return recommendationFromQuote(cheapest, estimateHoursFromQuote(cheapest))
  } catch {
    // A live quote failure must never block the demo; fall back to the
    // clearly-labelled simulation. The real failure is observable server-side
    // through the registry's error logging.
    return { ...SIMULATED_RECOMMENDATION, currency: order.currency || "ZAR" }
  }
}

/**
 * Runs the full AI order triage: fraud risk, stock verification,
 * auto-calculated weight & dimensions, and cheapest-courier recommendation.
 * This is the entry point used by the admin order detail page (Demo Step 5).
 */
export async function triageOrder(order: TriageOrder): Promise<OrderTriage> {
  const fraudRisk = assessFraudRisk(order)
  const stock = verifyStock(order)
  const physical = calculateWeightAndDimensions(order)
  const recommendation = await recommendCourier(order)
  return { fraudRisk, stock, physical, recommendation }
}

// ── Tracking number generation ────────────────

/**
 * Generates a deterministic simulated tracking number for an order
 * (e.g. `BG-ZA-948201`). The numeric segment is derived from a stable hash of
 * the order number so re-running fulfilment yields the same tracking number
 * for the same order — important for demo reproducibility and idempotency.
 */
export function generateTrackingNumber(orderNumber: string): string {
  let hash = 0
  for (let i = 0; i < orderNumber.length; i++) {
    hash = (hash * 31 + orderNumber.charCodeAt(i)) >>> 0
  }
  const segment = (hash % 1_000_000).toString().padStart(6, "0")
  return `BG-ZA-${segment}`
}
