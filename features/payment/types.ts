/**
 * ShopNova - Payment provider abstraction types.
 *
 * The guidebook requires a clean payment-provider abstraction so Stripe
 * and PayFast do not become tightly coupled to checkout business logic,
 * and additional gateways (Yoco, Stitch later) can drop in behind the
 * same interface. Raw card data NEVER touches ShopNova servers — both
 * providers redirect the customer to their hosted/embedded payment UI.
 */

/** Provider identifiers known to the platform today. */
export type PaymentProviderId = "stripe" | "payfast" | "test"

/**
 * A payment-orderable snapshot the provider needs to redirect the
 * customer. Amounts are authoritative: the caller (checkout action)
 * computes them from PostgreSQL values only.
 */
export interface PaymentOrder {
  /** Server-generated order number, e.g. SN-20260818-000123. */
  orderNumber: string
  /** Authoritative amount in the provider's minor unit (cents). */
  amountCents: number
  /** ISO currency code. Stripe uses lowercase "zar"; PayFast uses "ZAR". */
  currency: "zar" | "ZAR"
  /** Customer email shown on the hosted payment page. */
  customerEmail: string
  /** Where the provider sends the customer after a successful payment. */
  successUrl: string
  /** Where the provider sends the customer after a cancelled/failed payment. */
  cancelUrl: string
  /** Callback URL the provider posts the payment notification to. */
  notifyUrl: string
  /** Arbitrary data echoed back on the provider notification. */
  metadata: PaymentMetadata
}

/** Metadata the provider round-trips on the hosted flow. */
export interface PaymentMetadata {
  /** Our CheckoutIntent id (no Order exists yet — the order is created on verified payment). */
  intentId: string
  /** Our server-side provider label, e.g. "stripe" | "payfast". */
  provider: PaymentProviderId
}

/** A prepared hosted-payment session returned by a provider. */
export interface PaymentSession {
  provider: PaymentProviderId
  /** URL the shopper is redirected to for payment (hosted UI). */
  redirectUrl: string
  /** Provider-side reference for this session/order, e.g. Stripe `cs_test_*`. */
  providerReference: string
}

/**
 * A verified server-side payment notification extracted from a webhook.
 * Only populated after the provider signature / event authenticity has
 * been verified — never from data the browser sends.
 */
export interface PaymentNotification {
  /** Unique provider event id for idempotency (Strripe event id / PayFast pf_payment_id). */
  payloadKey: string
  /** True only when the gateway reports the money was captured. */
  success: boolean
  /** Gateway order reference echoed from our session, e.g. `cs_test_*`. */
  providerReference: string
  /** Our CheckoutIntent id, read from gateway metadata (never browser). */
  intentId?: string
  /** Charge amount in minor unines from the verified event. */
  amountMinor: number
  /** ISO currency code from the verified event (lowercase). */
  currency: string
  /** Error code when the payment failed. */
  errorCode?: string
}

/** Defines the contract every gateway adapter implements. */
export interface PaymentProvider {
  readonly id: PaymentProviderId

  /** True when this gateway's server-side configuration is complete enough to use. */
  isConfigured(): boolean

  /**
   * Creates a hosted-payment session and returns the redirect target.
   * Card data never touches the ShopNova server.
   */
  createSession(input: PaymentOrder): Promise<PaymentSession>

  /**
   * Verifies the raw provider callback/server event and returns the
   * normalized payment notification. MUST throw when the signature or
   * event authenticity cannot be verified server-side; MUST NOT trust
   * the browser. Returns null when the notification is not applicable
   * to us (e.g. an unsupported event type).
   */
  handleWebhook(
    body: string,
    headers: Record<string, string>,
    query: Record<string, string>
  ): Promise<PaymentNotification | null>
}
