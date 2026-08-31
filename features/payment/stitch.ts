/**
 * ShopNova - Stitch payment provider adapter.
 *
 * Stitch is an SA payment orchestration platform (Pay By Bank, EFT, Card,
 * Capitec Pay, etc.). The hosted payment flow is:
 *   1. Obtain a client token via OAuth 2.0 client credentials.
 *   2. Create a payment initiation request via a GraphQL mutation
 *      (`clientPaymentInitiationRequestCreate`) — returns an `id` + hosted
 *      `url` the customer is redirected to.
 *   3. Confirm the outcome via a signed webhook (delivered by Svix).
 *
 * IMPLEMENTATION STATUS (honest):
 * - The hosted-payment-session creation flow (step 2) is NOT implemented.
 *   The exact `clientPaymentInitiationRequestCreate` GraphQL mutation input
 *   contract is not available in this environment in a form that can be
 *   implemented accurately, and the guidebook forbids inventing API
 *   request/response shapes. `createSession` therefore throws a clear
 *   "pending" error and `isConfigured()` returns false so the provider can
 *   never be selected until that contract is wired up.
 * - What IS implemented accurately from the official public docs:
 *     * OAuth 2.0 client-credentials token retrieval (`getStitchClientToken`).
 *     * Svix / Standard Webhooks signature verification (`svix-*` headers,
 *       shared `standard-webhooks.ts` verifier).
 *     * Webhook event parsing per the documented `payment` event payload
 *       (docs.stitch.money/webhooks/types).
 *
 * WEBHOOK VERIFICATION (Svix, official):
 * - Stitch delivers webhooks via Svix. Each delivery carries `svix-id`,
 *   `svix-timestamp`, `svix-signature` headers, signed with HMAC-SHA256
 *   over `id.timestamp.body` using the base64-decoded `whsec_…` signing
 *   secret. This is the Standard Webhooks scheme, shared with Yoco.
 *
 * WEBHOOK PAYLOAD (official example):
 * - The body is `{ data: { client: { paymentInitiationRequests: { node } } } }`.
 * - `node.state.__typename` is the status: `PaymentInitiationRequestCompleted`
 *   (success), `PaymentInitiationRequestCancelled` / `PaymentInitiationRequestExpired`
 *   (failure). Pending/intermediate states are ignored.
 * - `node.externalReference` is the value supplied at creation — we set it to
 *   our CheckoutIntent id so the webhook correlates without trusting a
 *   client-supplied id.
 * - `node.amount` is `{ currency, quantity }`. `quantity` is treated as the
 *   amount in the currency's minor unit (cents), consistent with the rest of
 *   the platform; the authoritative-amount guard fails closed if a real
 *   delivery does not match the server-computed intent amount.
 *
 * SECURITY:
 * - The Svix signature is verified server-side; the browser redirect is
 *   never trusted (Stitch's own docs: "Don't use status for database
 *   operations — anyone can tamper with a query string parameter").
 * - The Svix message id (`svix-id` header) is the idempotency key.
 *
 * STATUS: structural + verified sub-components only. NOT live; never
 * exercised against the Stitch sandbox (no credentials, and the hosted-
 * session creation mutation is pending the official contract).
 */
import "server-only"

import type {
  PaymentNotification,
  PaymentOrder,
  PaymentProvider,
  PaymentSession,
} from "./types"
import { verifyStandardWebhook } from "./standard-webhooks"

const STITCH_CLIENT_ID = process.env.STITCH_CLIENT_ID
const STITCH_CLIENT_SECRET = process.env.STITCH_CLIENT_SECRET
const STITCH_WEBHOOK_SECRET = process.env.STITCH_WEBHOOK_SECRET

const STITCH_TOKEN_URL = "https://secure.stitch.money/connect/token"
const STITCH_TOKEN_AUDIENCE = "https://secure.stitch.money/connect/token"
/** Scope required to create payment initiation requests. */
const STITCH_PAYMENT_SCOPE = "client_paymentrequest"
/** Scope required to manage webhook subscriptions. */
const STITCH_WEBHOOK_SCOPE = "client_webhook_manage"

/**
 * The hosted-payment-session creation flow is pending the official
 * `clientPaymentInitiationRequestCreate` GraphQL mutation contract. Until it
 * is implemented, the Stitch provider is intentionally NOT configurable
 * end-to-end — it can never be selected by checkout, so no real Stitch
 * CheckoutIntent is ever created. Flip this to true (and implement
 * `createSession`) once the mutation contract is wired up.
 */
const STITCH_CREATE_SESSION_IMPLEMENTED = false

/** Final payment states we act on (per docs.stitch.money/webhooks/types). */
const STITCH_SUCCESS_STATE = "PaymentInitiationRequestCompleted"
const STITCH_FAILED_STATES = new Set([
  "PaymentInitiationRequestCancelled",
  "PaymentInitiationRequestExpired",
])

/** Documented `payment` webhook event body (only the fields we rely on). */
interface StitchWebhookEvent {
  /** Some Stitch deliveries include a top-level event id; the Svix id is preferred. */
  id?: string
  data?: {
    client?: {
      paymentInitiationRequests?: {
        node?: {
          id?: string
          externalReference?: string
          currency?: string
          amount?: { currency?: string; quantity?: string | number }
          state?: { __typename?: string }
        }
      }
    }
  }
}

export class StitchProvider implements PaymentProvider {
  readonly id = "stitch"

  isConfigured(): boolean {
    // Never selectable until the hosted-session creation flow is implemented.
    return (
      STITCH_CREATE_SESSION_IMPLEMENTED &&
      Boolean(STITCH_CLIENT_ID && STITCH_CLIENT_SECRET && STITCH_WEBHOOK_SECRET)
    )
  }

  async createSession(
    _input: PaymentOrder
  ): Promise<PaymentSession> {
    // Intentionally not implemented: the official
    // `clientPaymentInitiationRequestCreate` GraphQL mutation input contract
    // is not available to implement accurately here. Do NOT guess the
    // mutation fields — see the module docstring.
    throw new Error(
      "Stitch hosted-payment-session creation is not implemented: pending the official clientPaymentInitiationRequestCreate GraphQL mutation contract."
    )
  }

  async handleWebhook(
    body: string,
    headers: Record<string, string>,
    _query: Record<string, string>
  ): Promise<PaymentNotification | null> {
    if (!STITCH_WEBHOOK_SECRET) {
      throw new Error("Stitch is not configured on the server.")
    }

    if (
      !verifyStandardWebhook({
        body,
        headers,
        secret: STITCH_WEBHOOK_SECRET,
        headerPrefix: "svix",
      })
    ) {
      throw new Error("Invalid Stitch signature.")
    }

    const event = JSON.parse(body) as StitchWebhookEvent
    const node = event.data?.client?.paymentInitiationRequests?.node
    // A delivery that is not a payment-initiation-request update is ignored.
    if (!node) return null

    const state = node.state?.__typename
    const success = state === STITCH_SUCCESS_STATE
    const failed = state ? STITCH_FAILED_STATES.has(state) : false
    // Pending / intermediate states are not final — acknowledge and ignore.
    if (!success && !failed) return null

    const amount = node.amount
    const currency = (amount?.currency ?? node.currency ?? "zar").toLowerCase()

    // The Svix message id is the canonical idempotency key (stable across
    // retries); fall back to the Stitch payment-request id / external ref.
    const payloadKey =
      headers["svix-id"] ?? event.id ?? node.id ?? `stitch:${node.externalReference ?? ""}:${state ?? ""}`

    return {
      payloadKey,
      success,
      providerReference: node.id ?? "",
      intentId: node.externalReference,
      amountMinor: parseStitchAmount(amount?.quantity),
      currency,
      errorCode: success ? undefined : "stitch:payment_failed",
    }
  }
}

/**
 * Obtains a Stitch client access token via the OAuth 2.0 client-credentials
 * flow (docs.stitch.money/authentication/client-tokens). Server-side only;
 * the client secret never reaches the browser.
 *
 * Implemented per the official contract but not unit-tested (it performs a
 * live network call). Exposed for the future hosted-session creation flow.
 */
export async function getStitchClientToken(
  scopes: readonly string[] = [STITCH_PAYMENT_SCOPE, STITCH_WEBHOOK_SCOPE]
): Promise<string> {
  if (!STITCH_CLIENT_ID || !STITCH_CLIENT_SECRET) {
    throw new Error("Stitch client credentials are not configured on the server.")
  }

  const params = new URLSearchParams({
    client_id: STITCH_CLIENT_ID,
    scope: scopes.join(" "),
    grant_type: "client_credentials",
    audience: STITCH_TOKEN_AUDIENCE,
    client_secret: STITCH_CLIENT_SECRET,
  })

  const res = await fetch(STITCH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Stitch token retrieval failed: ${res.status} ${text}`)
  }

  const token = (await res.json()) as { access_token?: string }
  if (!token.access_token) {
    throw new Error("Stitch token response did not include an access_token.")
  }
  return token.access_token
}

/**
 * Parses a Stitch `amount.quantity` value (string or number) into minor units
 * (cents). Stitch represents amounts as strings to preserve precision; we
 * treat the value as cents, consistent with the rest of the platform. The
 * authoritative-amount guard rejects a delivery whose amount does not match
 * the server-computed intent amount, so a misinterpretation fails closed.
 */
function parseStitchAmount(quantity: string | number | undefined): number {
  if (quantity === undefined || quantity === null) return 0
  const n = Number(quantity)
  if (!Number.isFinite(n)) return 0
  return Math.round(n)
}
