/**
 * ShopNova - Payment server actions.
 *
 * Wires the checkout form to the payment-provider abstraction WITHOUT
 * trusting the browser:
 *
 * - `startCheckoutPaymentAction` validates the checkout form, creates a
 *   PENDING CheckoutIntent with an authoritative server-computed amount
 *   (re-read from PostgreSQL), selects the gateway server-side (PayFast
 *   for SA, Stripe for international, mock Test gateway as a local-dev
 *   fallback), creates the hosted-payment session, and returns the
 *   redirect URL. No order is created yet and no inventory is touched.
 * - `completeTestPaymentAction` simulates a verified gateway callback for
 *   the mock Test provider so the full intent -> order -> payment path
 *   runs locally without real credentials. It still goes through the
 *   same `completePaidIntent` completion path (idempotency, amount guard,
 *   inventory safety) as a real webhook.
 *
 * Raw card data NEVER touches ShopNova servers — both real providers and
 * the mock provider redirect the customer to a hosted payment UI.
 */
"use server"

import { headers } from "next/headers"

import { cartStore } from "@/features/cart/cart-store"
import { getShopperId } from "@/features/cart/session"
import { checkoutSchema, type CheckoutFormValues } from "@/lib/validations/checkout"
import {
  attachProviderReference,
  completePaidIntent,
  createCheckoutIntent,
  getIntentById,
  type PaymentCompletionResult,
} from "@/lib/db"
import { getProvider } from "./provider-registry"
import { selectProviderForCountry, toAmountCents } from "./payment-logic"
import type { PaymentNotification, PaymentProviderId } from "./types"

/** Result of starting a checkout payment. */
export interface StartPaymentResult {
  /** Absolute (or relative for the test gateway) URL to redirect the shopper to. */
  redirectUrl?: string
  /** Provider that was selected server-side. */
  provider?: PaymentProviderId
  /** Order number reserved for this checkout (shown on the confirmation page). */
  orderNumber?: string
  error?: string
}

/**
 * Returns the absolute origin (scheme + host) for the current request so
 * gateway success/cancel/notify URLs can be built server-side.
 */
async function getRequestOrigin(): Promise<string> {
  const headerList = await headers()
  const host = headerList.get("host")
  if (!host) {
    throw new Error("Unable to determine the request host.")
  }
  // Respect the forwarded proto when behind a proxy/edge (Vercel, ngrok).
  const forwardedProto = headerList.get("x-forwarded-proto")
  const protocol = forwardedProto ?? (process.env.NODE_ENV === "production" ? "https" : "http")
  return `${protocol}://${host}`
}

/**
 * Validates checkout details, creates a PENDING CheckoutIntent with an
 * authoritative server-computed amount, selects the payment provider
 * server-side, creates the hosted-payment session, and returns the
 * redirect URL. The client is never trusted for price, provider, or
 * inventory — only contact + shipping details + cart line identities.
 */
export async function startCheckoutPaymentAction(
  input: CheckoutFormValues
): Promise<StartPaymentResult> {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid checkout details.",
    }
  }

  const shopperId = await getShopperId()
  const cart = await cartStore.getCart(shopperId)
  if (!cart || cart.items.length === 0) {
    return { error: "Your cart is empty." }
  }

  // Snapshot only product ids + quantities — prices are NEVER trusted
  // from the cart snapshot; they are re-read from PostgreSQL inside
  // createCheckoutIntent and again inside completePaidIntent.
  const items = cart.items.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
  }))

  // Select the gateway server-side. PayFast is the SA default; Stripe for
  // international. Falls back to the mock Test provider when the selected
  // real gateway is not configured (local dev without credentials).
  const desiredProvider = selectProviderForCountry(parsed.data.country)
  let provider = await getProvider(desiredProvider)
  if (!provider) {
    provider = await getProvider("test")
  }
  if (!provider) {
    return { error: "No payment provider is configured on the server." }
  }

  let intent
  try {
    intent = await createCheckoutIntent({
      shopperId,
      provider: provider.id,
      details: parsed.data,
      items,
    })
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to start checkout.",
    }
  }

  // Re-read the persisted intent to get the authoritative server-computed
  // amount. The provider session is created with THIS amount, never a
  // client-supplied total.
  const persisted = await getIntentById(intent.intentId)
  if (!persisted) {
    return { error: "Checkout intent could not be found." }
  }

  const origin = await getRequestOrigin()
  const orderNumber = intent.orderNumber
  const successUrl = `${origin}/checkout/success?orderNumber=${orderNumber}`
  const cancelUrl = `${origin}/checkout?canceled=1`
  const notifyUrl = `${origin}/api/webhooks/${provider.id}`

  let session
  try {
    session = await provider.createSession({
      orderNumber,
      amountCents: toAmountCents(Number(persisted.amount)),
      currency: "zar",
      customerEmail: parsed.data.email,
      successUrl,
      cancelUrl,
      notifyUrl,
      metadata: { intentId: intent.intentId, provider: provider.id },
    })
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create the payment session.",
    }
  }

  await attachProviderReference(intent.intentId, session.providerReference)

  return {
    redirectUrl: session.redirectUrl,
    provider: provider.id,
    orderNumber,
  }
}

/** Result of simulating a test-gateway payment callback. */
export interface CompleteTestPaymentResult {
  result: PaymentCompletionResult
}

/**
 * Simulates a verified Test-gateway payment callback. Used by the local
 * mock payment page so the full intent -> order -> payment path runs
 * without real credentials. The constructed notification is fed through
 * the same `completePaidIntent` completion path as a real webhook, so
 * idempotency, the authoritative-amount guard, and inventory safety all
 * apply. The browser alone can never call this for a real provider.
 */
export async function completeTestPaymentAction(
  intentId: string,
  success: boolean
): Promise<CompleteTestPaymentResult> {
  const intent = await getIntentById(intentId)
  if (!intent) {
    return {
      result: { status: "not-found" },
    }
  }

  // Deterministic per (intent, outcome) so a repeated click of the same
  // button is a true duplicate event — exercising the idempotency guard.
  const notification: PaymentNotification = {
    payloadKey: `test:${intentId}:${success ? "ok" : "fail"}`,
    success,
    providerReference: `test-${intentId}`,
    intentId,
    amountMinor: toAmountCents(Number(intent.amount)),
    currency: "zar",
    errorCode: success ? undefined : "declined",
  }

  const result = await completePaidIntent(notification)
  return { result }
}
