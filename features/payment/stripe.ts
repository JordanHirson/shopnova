/**
 * ShopNova - Stripe payment provider adapter.
 *
 * Uses Stripe Checkout Sessions (hosted payment page) so raw card data
 * never touches ShopNova servers. Implemented with direct API calls —
 * no `stripe` npm package required.
 *
 * SECURITY:
 * - Session amounts come ONLY from the authoritative server value.
 * - The webhook signature is verified with HMAC SHA-256 using
 *   STRIPE_WEBHOOK_SECRET; a browser callback is never trusted.
 */
import "server-only"

import { createHmac, timingSafeEqual } from "crypto"

import type {
  PaymentNotification,
  PaymentOrder,
  PaymentProvider,
  PaymentSession,
} from "./types"

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

const STRIPE_API_BASE = "https://api.stripe.com/v1"

export class StripeProvider implements PaymentProvider {
  readonly id = "stripe"

  isConfigured(): boolean {
    return Boolean(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET)
  }

  async createSession(input: PaymentOrder): Promise<PaymentSession> {
    if (!this.isConfigured()) {
      throw new Error("Stripe is not configured on the server.")
    }

    const params = new URLSearchParams({
      mode: "payment",
      "line_items[0][price_data][currency]": input.currency,
      "line_items[0][price_data][product_data][name]": `ShopNova Order ${input.orderNumber}`,
      "line_items[0][price_data][unit_amount]": String(input.amountCents),
      "line_items[0][quantity]": "1",
      "customer_email": input.customerEmail,
      "success_url": input.successUrl,
      "cancel_url": input.cancelUrl,
      "metadata[intentId]": input.metadata.intentId,
      "metadata[provider]": input.metadata.provider,
    })

    const res = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Stripe session creation failed: ${res.status} ${text}`)
    }

    const session = (await res.json()) as {
      id: string
      url: string | null
    }

    if (!session.url) {
      throw new Error("Stripe returned a session without a hosted URL.")
    }

    return {
      provider: this.id,
      redirectUrl: session.url,
      providerReference: session.id,
    }
  }

  async handleWebhook(
    body: string,
    headers: Record<string, string>,
    _query: Record<string, string>
  ): Promise<PaymentNotification | null> {
    if (!this.isConfigured()) {
      throw new Error("Stripe is not configured on the server.")
    }

    const signature = headers["stripe-signature"]
    if (!signature) {
      throw new Error("Missing Stripe signature.")
    }
    const verified = verifyStripeSignature(body, signature)
    if (!verified) {
      throw new Error("Invalid Stripe signature.")
    }

    const event = JSON.parse(body) as {
      id: string
      type: string
      data: {
        object: {
          id?: string
          payment_status?: string
          amount_total?: number
          currency?: string
          metadata?: { intentId?: string }
        }
      }
    }

    if (event.type === "checkout.session.async_payment_succeeded" ||
      event.type === "checkout.session.completed") {
      return {
        payloadKey: event.id,
        success: true,
        providerReference: event.data.object.id ?? "",
        intentId: event.data.object.metadata?.intentId,
        amountMinor: event.data.object.amount_total ?? 0,
        currency: (event.data.object.currency ?? "zar").toLowerCase(),
      }
    }

    if (event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed") {
      return {
        payloadKey: event.id,
        success: false,
        providerReference: event.data.object.id ?? "",
        intentId: event.data.object.metadata?.intentId,
        amountMinor: event.data.object.amount_total ?? 0,
        currency: (event.data.object.currency ?? "zar").toLowerCase(),
        errorCode: "stripe:payment_failed",
      }
    }

    return null
  }
}

/**
 * Verifies the `t=...,v1=...` signature from the Stripe-Signature header.
 */
function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string
): boolean {
  const pairs = new Map(
    signatureHeader.split(",").map((p) => {
      const [k, v] = p.trim().split("=")
      return [k, v]
    })
  )
  const timestamp = pairs.get("t")
  const expected = pairs.get("v1")
  if (!timestamp || !expected) return false
  if (!STRIPE_WEBHOOK_SECRET) return false

  const signed = `${timestamp}.${rawBody}`
  const computed = createHmac("sha256", STRIPE_WEBHOOK_SECRET)
    .update(signed)
    .digest("hex")

  const a = Buffer.from(computed)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}