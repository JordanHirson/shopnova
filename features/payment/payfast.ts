/**
 * ShopNova - PayFast payment provider adapter.
 *
 * Uses the hosted PayFast payment form (iframe/redirect) so raw card data
 * never touches ShopNova servers. Server-to-server ITN (Instant
 * Transaction Notification) callbacks are signature-verified with MD5
 * over the sorted POST fields + passphrase.
 *
 * SECURITY:
 * - The payment amount passed to PayFast comes ONLY from the authoritative
 *   server value.
 * - The ITN callback is verified server-side; a browser callback is never
 *   trusted.
 */
import "server-only"

import { createHash } from "crypto"

import type {
  PaymentNotification,
  PaymentOrder,
  PaymentProvider,
  PaymentSession,
} from "./types"

const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE
const PAYFAST_TEST_MODE = process.env.PAYFAST_TEST_MODE === "true"

// Sandbox vs production endpoints.
const PAYFAST_FORM_URL = PAYFAST_TEST_MODE
  ? "https://sandbox.payfast.co.za/eng/process"
  : "https://www.payfast.co.za/eng/process"

export class PayFastProvider implements PaymentProvider {
  readonly id = "payfast"

  isConfigured(): boolean {
    return Boolean(
      PAYFAST_MERCHANT_ID &&
        PAYFAST_MERCHANT_KEY &&
        PAYFAST_PASSPHRASE
    )
  }

  async createSession(input: PaymentOrder): Promise<PaymentSession> {
    if (!this.isConfigured()) {
      throw new Error("PayFast is not configured on the server.")
    }

    // Build the hosted-form POST fields (no card data).
    const fields: Record<string, string> = {
      merchant_id: PAYFAST_MERCHANT_ID!,
      merchant_key: PAYFAST_MERCHANT_KEY!,
      return_url: input.successUrl,
      cancel_url: input.cancelUrl,
      notify_url: input.notifyUrl,
      m_payment_id: input.metadata.intentId,
      amount: (input.amountCents / 100).toFixed(2),
      item_name: `ShopNova Order ${input.orderNumber}`,
      email_address: input.customerEmail,
    }

    const signature = signPayFast(fields)
    fields.signature = signature

    return {
      provider: this.id,
      redirectUrl: `${PAYFAST_FORM_URL}?${new URLSearchParams(fields).toString()}`,
      providerReference: `pf-${input.metadata.intentId}`,
    }
  }

  async handleWebhook(
    body: string,
    _headers: Record<string, string>,
    query: Record<string, string>
  ): Promise<PaymentNotification | null> {
    if (!this.isConfigured()) {
      throw new Error("PayFast is not configured on the server.")
    }

    // The ITN posts form-encoded fields as the body AND as query params.
    const params = new URLSearchParams(body)
    const fields: Record<string, string> = {}
    for (const [key, value] of params.entries()) {
      fields[key] = value
    }

    const signature = fields.signature
    if (!signature) {
      throw new Error("Missing PayFast signature.")
    }
    const expected = signPayFast(fields)
    if (signature !== expected) {
      throw new Error("Invalid PayFast signature.")
    }

    const paymentStatus = query["payment_status"] ?? fields.payment_status
    const success = paymentStatus === "COMPLETE"

    const pfPaymentId = query["pf_payment_id"] ?? fields.pf_payment_id
    const amount = Number(query["amount_gross"] ?? fields.amount_gross ?? fields.amount ?? "0")
    const currency = (query["currency"] ?? fields.currency ?? "zar").toLowerCase()
    const intentId = query["m_payment_id"] ?? fields.m_payment_id ?? ""

    return {
      payloadKey: pfPaymentId
        ? `pf:${pfPaymentId}`
        : `pf:${intentId}:${fields.item_name ?? ""}`,
      success,
      providerReference: `pf-${intentId}`,
      intentId: intentId || undefined,
      amountMinor: Math.round(amount * 100),
      currency,
      errorCode: success ? undefined : "payfast:payment_failed",
    }
  }
}

/**
 * PayFast signature: MD5 of `field=value` pairs of all POST fields except
 * `signature`, joined with `&`, with the passphrase appended.
 *
 *   md5(passphrase=...&param=value&...)  (sorted by key)
 */
export function signPayFast(
  fields: Record<string, string>,
  passphrase?: string
): string {
  const sorted = Object.keys(fields)
    .filter((k) => k !== "signature")
    .sort()
    .map((k) => `${k}=${fields[k]}`)

  const secret = passphrase ?? PAYFAST_PASSPHRASE
  if (secret) {
    sorted.unshift(`passphrase=${secret}`)
  }

  return createHash("md5").update(sorted.join("&")).digest("hex")
}
