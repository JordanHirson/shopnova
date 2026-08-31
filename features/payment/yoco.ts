/**
 * ShopNova - Yoco payment provider adapter.
 *
 * Uses the Yoco Checkout API (a hosted, secure payment page) so raw card
 * data never touches ShopNova servers. Implemented with direct API calls —
 * no Yoco SDK dependency required.
 *
 * OFFICIAL API CONTRACT (developer.yoco.com / payments.yoco.com/api):
 * - Create a hosted checkout: `POST https://payments.yoco.com/api/checkouts`
 *   with `Authorization: Bearer <secret key>` and a JSON body
 *   `{ amount, currency, successUrl, cancelUrl, metadata }` where `amount`
 *   is in the currency's minor unit (cents). Returns `{ id, redirectUrl }`.
 * - Confirm the outcome via the signed webhook, NOT the successUrl redirect.
 *
 * WEBHOOK VERIFICATION:
 * - Yoco follows the Standard Webhooks specification. Each delivery carries
 *   `webhook-id`, `webhook-timestamp`, `webhook-signature` headers, signed
 *   with HMAC-SHA256 over `id.timestamp.body` using the base64-decoded
 *   `whsec_…` webhook secret. Verification + replay protection live in the
 *   shared `standard-webhooks.ts` module.
 * - Event types we act on: `payment.succeeded` (mark paid), `payment.failed`
 *   (mark failed). Other event types are acknowledged and ignored.
 *
 * SECURITY:
 * - Session amounts come ONLY from the authoritative server value.
 * - The webhook signature is verified server-side; the browser redirect is
 *   never trusted.
 * - The intent id is round-tripped through Yoco `metadata` (echoed back in
 *   `payload.metadata`) so the webhook correlates to our CheckoutIntent
 *   without trusting a client-supplied id.
 *
 * STATUS: implemented per the official public API contract and unit-tested
 * against real signature math. NOT exercised against the live Yoco API
 * (no credentials in this environment), so it is not marked production-verified.
 */
import "server-only"

import type {
  PaymentNotification,
  PaymentOrder,
  PaymentProvider,
  PaymentSession,
} from "./types"
import { verifyStandardWebhook } from "./standard-webhooks"

const YOCO_SECRET_KEY = process.env.YOCO_SECRET_KEY
const YOCO_WEBHOOK_SECRET = process.env.YOCO_WEBHOOK_SECRET

const YOCO_API_BASE = "https://payments.yoco.com/api"

/** Shape of the Yoco webhook event body (only the fields we rely on). */
interface YocoWebhookEvent {
  id: string
  type: string
  payload?: {
    id?: string
    amount?: number
    currency?: string
    metadata?: { intentId?: string }
  }
}

export class YocoProvider implements PaymentProvider {
  readonly id = "yoco"

  isConfigured(): boolean {
    return Boolean(YOCO_SECRET_KEY && YOCO_WEBHOOK_SECRET)
  }

  async createSession(input: PaymentOrder): Promise<PaymentSession> {
    if (!this.isConfigured()) {
      throw new Error("Yoco is not configured on the server.")
    }

    const res = await fetch(`${YOCO_API_BASE}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${YOCO_SECRET_KEY}`,
        "Content-Type": "application/json",
        // Repeating the same intent yields one checkout (Yoco idempotency).
        "Idempotency-Key": input.metadata.intentId,
      },
      body: JSON.stringify({
        amount: input.amountCents,
        currency: input.currency.toUpperCase(),
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        metadata: {
          intentId: input.metadata.intentId,
          provider: input.metadata.provider,
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Yoco session creation failed: ${res.status} ${text}`)
    }

    const checkout = (await res.json()) as { id: string; redirectUrl: string | null }

    if (!checkout.redirectUrl) {
      throw new Error("Yoco returned a checkout without a redirect URL.")
    }

    return {
      provider: this.id,
      redirectUrl: checkout.redirectUrl,
      providerReference: checkout.id,
    }
  }

  async handleWebhook(
    body: string,
    headers: Record<string, string>,
    _query: Record<string, string>
  ): Promise<PaymentNotification | null> {
    if (!this.isConfigured()) {
      throw new Error("Yoco is not configured on the server.")
    }

    if (
      !verifyStandardWebhook({
        body,
        headers,
        secret: YOCO_WEBHOOK_SECRET!,
        headerPrefix: "webhook",
      })
    ) {
      throw new Error("Invalid Yoco signature.")
    }

    const event = JSON.parse(body) as YocoWebhookEvent

    if (event.type === "payment.succeeded") {
      return {
        payloadKey: event.id,
        success: true,
        providerReference: event.payload?.id ?? "",
        intentId: event.payload?.metadata?.intentId,
        amountMinor: event.payload?.amount ?? 0,
        currency: (event.payload?.currency ?? "zar").toLowerCase(),
      }
    }

    if (event.type === "payment.failed") {
      return {
        payloadKey: event.id,
        success: false,
        providerReference: event.payload?.id ?? "",
        intentId: event.payload?.metadata?.intentId,
        amountMinor: event.payload?.amount ?? 0,
        currency: (event.payload?.currency ?? "zar").toLowerCase(),
        errorCode: "yoco:payment_failed",
      }
    }

    // Unhandled event type (e.g. refund.*): acknowledge so Yoco stops retrying.
    return null
  }
}
