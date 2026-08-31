/**
 * ShopNova - Payment business logic (pure functions).
 *
 * Intentionally dependency-free so it can be unit tested with Node's
 * native test runner. All money math is in integer minor units (cents).
 *
 * SECURITY RULES:
 * - Payment amounts MUST be derived from authoritative server values.
 * - Browser-supplied totals are NEVER accepted.
 * - A provider is only usable if its server-side configuration exists.
 */
import type { PaymentProviderId } from "./types"

// ── Business rules ────────────────────────────

/** Gateway providers this build knows how to talk to. */
export const SUPPORTED_PROVIDERS: readonly PaymentProviderId[] = [
  "stripe",
  "payfast",
  "yoco",
  "stitch",
  "test",
] as const

/** Country selection rule from the guidebook: PayFast is the SA default. */
export const SOUTH_AFRICA_COUNTRY = "South Africa"

/**
 * Selects the default provider for a destination country.
 * - South Africa => PayFast (guidebook requirement)
 * - International => Stripe
 */
export function selectProviderForCountry(country: string): PaymentProviderId {
  if (country.trim().toLowerCase() === SOUTH_AFRICA_COUNTRY.toLowerCase()) {
    return "payfast"
  }
  return "stripe"
}

/**
 * Resolves a provider requested by the client against the providers that
 * are actually configured server-side. Returns null when the provider is
 * unknown or its server-side config (secret keys etc.) is missing.
 */
export function resolveProvider(
  requested: string,
  configured: PaymentProviderId[]
): PaymentProviderId | null {
  if (!SUPPORTED_PROVIDERS.includes(requested as PaymentProviderId)) {
    return null
  }
  const provider = requested as PaymentProviderId
  return configured.includes(provider) ? provider : null
}

/** Converts a server-authoritative decimal amount to minor units (cents). */
export function toAmountCents(amount: number): number {
  return Math.round(amount * 100)
}

/**
 * Returns true when the server-computed amount (in currency units)
 * exactly matches the provider's verified minor-unit amount. This is the
 * authoritative-amount guard: a tampered client total can never match
 * the server re-computed total AND the gateway's verified charge.
 */
export function amountMatches(
  serverAmount: number,
  providerMinorUnits: number
): boolean {
  return toAmountCents(serverAmount) === providerMinorUnits
}

/** Returns true when two currency codes match without case sensitivity. */
export function currencyMatches(
  expectedCurrency: string,
  providerCurrency: string
): boolean {
  return expectedCurrency.trim().toLowerCase() === providerCurrency.trim().toLowerCase()
}

/**
 * Returns true only when the local test gateway is being used by the shopper
 * who owns the intent outside production.
 */
export function isTestPaymentAllowed(
  nodeEnv: string | undefined,
  intentProvider: string,
  intentShopperId: string,
  currentShopperId: string | null | undefined
): boolean {
  return (
    nodeEnv !== "production" &&
    intentProvider === "test" &&
    intentShopperId === currentShopperId
  )
}

/** Final amount the provider must charge: authoritative total in cents. */
export function providerAmountFromTotal(total: number): number {
  return toAmountCents(total)
}

/**
 * Returns true only when a webhook's provider matches the intent's provider.
 *
 * Webhook processing is provider-specific: a verified notification from
 * gateway X must never complete a CheckoutIntent created for gateway Y.
 * Provider ids are case-sensitive (they are server-generated, never
 * client-supplied), so an exact comparison is the correct boundary.
 */
export function isProviderMatch(
  intentProvider: string,
  webhookProvider: string
): boolean {
  return intentProvider === webhookProvider
}
