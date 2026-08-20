/**
 * ShopNova - Test payment provider (mock gateway).
 *
 * Enables the full checkout → hosted payment → verified webhook flow
 * locally and in automated tests WITHOUT real payment credentials or a
 * real card. The "hosted" payment page is our own completion page; the
 * completion callback is signed like a real gateway webhook and MUST
 * still pass server-side verification — the browser alone is never
 * trusted.
 */
import "server-only"

import { createHmac, timingSafeEqual } from "crypto"

import type {
  PaymentNotification,
  PaymentOrder,
  PaymentProvider,
  PaymentSession,
} from "./types"

/** The mock completion path users visit after "paying". */
const TEST_REDIRECT_PATH = "/checkout/test-pay"

/** Local signer — replaced by a real TEST_PAYMENT_SECRET in production deployments. */
const TEST_WEBHOOK_SECRET = process.env.TEST_PAYMENT_SECRET ?? "dev-test-secret"

export class TestProvider implements PaymentProvider {
  readonly id = "test"

  isConfigured(): boolean {
    // The test gateway is always available so the integration runs
    // without Stripe/PayFast credentials.
    return true
  }

  async createSession(input: PaymentOrder): Promise<PaymentSession> {
    return {
      provider: this.id,
      redirectUrl: `${TEST_REDIRECT_PATH}?intentId=${input.metadata.intentId}`,
      providerReference: `test-${input.metadata.intentId}`,
    }
  }

  async handleWebhook(
    body: string,
    headers: Record<string, string>,
    _query: Record<string, string>
  ): Promise<PaymentNotification | null> {
    const signature = headers["x-test-signature"]
    if (!signature) throw new Error("Missing test payment signature.")

    const expected = signTestBody(body)
    if (!safeEqual(signature, expected)) {
      throw new Error("Invalid test payment signature.")
    }

    const payload = JSON.parse(body) as {
      intentId: string
      success: boolean
      amountMinor: number
      currency: string
      eventId: string
    }

    if (!payload.intentId || !payload.eventId) {
      throw new Error("Malformed test payment notification.")
    }

    return {
      payloadKey: payload.eventId,
      success: payload.success,
      providerReference: `test-${payload.intentId}`,
      intentId: payload.intentId,
      amountMinor: payload.amountMinor,
      currency: payload.currency.toLowerCase(),
      errorCode: payload.success ? undefined : "declined",
    }
  }
}

/** Signs the raw body so the callback cannot be forged by a browser. */
export function signTestBody(body: string): string {
  return createHmac("sha256", TEST_WEBHOOK_SECRET).update(body).digest("hex")
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}