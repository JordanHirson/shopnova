/**
 * ShopNova - Stitch payment provider adapter.
 *
 * Stitch is an SA payment orchestration platform (Pay By Bank, EFT, Card,
 * Capitec Pay, etc.). The hosted payment flow is:
 *   1. Obtain a client token via OAuth 2.0 client credentials.
 *   2. Create a payment initiation request via the
 *      `clientPaymentInitiationRequestCreate` GraphQL mutation — returns an
 *      `id` + hosted `url` the customer is redirected to.
 *   3. Confirm the outcome via a signed webhook (delivered by Svix).
 *
 * OFFICIAL API CONTRACT (docs.stitch.money):
 * - GraphQL endpoint: `POST https://api.stitch.money/graphql` (test + live).
 * - Auth: `Authorization: Bearer <client token>` where the token is obtained
 *   via the OAuth 2.0 client-credentials flow with the `client_paymentrequest`
 *   scope (docs.stitch.money/authentication/client-tokens).
 * - Idempotency: optional `Idempotency-Key` request header (UUID recommended,
 *   scoped to the client, retained 24h). We use the CheckoutIntent id.
 *   (docs.stitch.money/idempotency)
 * - Mutation:
 *     `clientPaymentInitiationRequestCreate(
 *        input: ClientPaymentInitiationRequestCreateInput!
 *     ): ClientPaymentInitiationRequestCreatePayload`
 *   Input fields (docs.stitch.money/api/inputs/client-payment-initiation-
 *   request-create-input):
 *     amount: MoneyInput!              // { quantity: Decimal!, currency: CurrencyCode! }
 *     payerReference: String!          // max 12 chars (payer's bank statement)
 *     beneficiaryReference: String!    // max 20 chars (beneficiary's bank statement)
 *     externalReference: String        // max 4096 chars (our correlation key)
 *     payerInformation: PayerInformationInput  // { payerId, ... } recommended
 *     expireAt: Date                   // ISO 8601, recommended
 *     ... (beneficiary [deprecated], merchant [deprecated], merchantId,
 *          paymentMethods, restrictPayerBank, etc. — omitted for a standard
 *          single-merchant hosted-UI integration)
 * - MoneyInput.quantity is in the currency's MAJOR unit (Rand), serialized as
 *   a Decimal string/number — NOT cents (docs.stitch.money/api/scalars/money:
 *   `{"quantity":"100.23","currency":"ZMW"}`; OTA API: "amount in major units
 *   (e.g. 350.5 for R350.50)"). We convert our authoritative cents value to
 *   major units on the way out and back to cents on the way in.
 * - Response payload: `ClientPaymentInitiationRequestCreatePayload` has a
 *   single non-null field `paymentInitiationRequest: PaymentInitiationRequest!`
 *   whose `id: ID!` and `url: URL!` are the two values we need.
 * - Hosted URL: the returned `url` needs a `redirect_uri` (allowlisted domain)
 *   appended as a query parameter; an optional `failure_redirect_uri` sends
 *   closed/failed outcomes to a separate page. The browser `status` query
 *   parameter is NEVER trusted for state — only the signed webhook is.
 *
 * WEBHOOK VERIFICATION (Svix, official):
 * - Stitch delivers webhooks via Svix. Each delivery carries `svix-id`,
 *   `svix-timestamp`, `svix-signature` headers, signed with HMAC-SHA256
 *   over `id.timestamp.body` using the base64-decoded `whsec_…` signing
 *   secret. This is the Standard Webhooks scheme, shared with Yoco.
 *
 * WEBHOOK PAYLOAD (official example, docs.stitch.money/webhooks):
 * - The body is `{ data: { client: { paymentInitiationRequests: { node } } } }`.
 * - `node.state.__typename` is the status: `PaymentInitiationRequestCompleted`
 *   (success), `PaymentInitiationRequestCancelled` / `PaymentInitiationRequestExpired`
 *   (failure). Pending/intermediate states are ignored.
 * - `node.externalReference` is the value supplied at creation — we set it to
 *   our CheckoutIntent id so the webhook correlates without trusting a
 *   client-supplied id.
 * - `node.amount` is `{ currency, quantity }` where `quantity` is a Decimal in
 *   MAJOR units (Rand), exactly as on creation. We convert it back to cents;
 *   the authoritative-amount guard fails closed if a real delivery does not
 *   match the server-computed intent amount.
 *
 * SECURITY:
 * - The Svix signature is verified server-side; the browser redirect is
 *   never trusted (Stitch's own docs: "Don't use status for database
 *   operations — anyone can tamper with a query string parameter").
 * - The Svix message id (`svix-id` header) is the idempotency key.
 * - All credentials (client id, client secret, webhook secret) are server-
 *   side only and never reach the browser.
 *
 * STATUS: implemented per the official public API contract and unit-tested
 * against real signature math (mocked `fetch` for `createSession`). NOT
 * exercised against the live Stitch sandbox (no credentials in this
 * environment), so it is not marked production-verified.
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
const STITCH_GRAPHQL_URL = "https://api.stitch.money/graphql"
/** Scope required to create payment initiation requests. */
const STITCH_PAYMENT_SCOPE = "client_paymentrequest"
/** Scope required to manage webhook subscriptions. */
const STITCH_WEBHOOK_SCOPE = "client_webhook_manage"

/** Hosted-payment-session creation is implemented against the official contract. */
const STITCH_CREATE_SESSION_IMPLEMENTED = true

/** Checkout request expiry (the hosted payment page must be completed by then). */
const STITCH_REQUEST_EXPIRY_MINUTES = 30

/** Documented character limits for bank-statement references. */
const STITCH_PAYER_REFERENCE_MAX = 12
const STITCH_BENEFICIARY_REFERENCE_MAX = 20

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

/** Shape of the GraphQL response for `clientPaymentInitiationRequestCreate`. */
interface StitchCreateResponse {
  data?: {
    clientPaymentInitiationRequestCreate?: {
      paymentInitiationRequest?: { id?: string; url?: string }
    }
  }
  errors?: Array<{ message?: string; extensions?: { code?: string } }>
}

export class StitchProvider implements PaymentProvider {
  readonly id = "stitch"

  isConfigured(): boolean {
    // Selectable only when the complete flow is implemented AND all server-
    // side credentials are present (client credentials to create a session +
    // webhook secret to verify the outcome).
    return (
      STITCH_CREATE_SESSION_IMPLEMENTED &&
      Boolean(STITCH_CLIENT_ID && STITCH_CLIENT_SECRET && STITCH_WEBHOOK_SECRET)
    )
  }

  async createSession(input: PaymentOrder): Promise<PaymentSession> {
    if (!this.isConfigured()) {
      throw new Error("Stitch is not configured on the server.")
    }

    // 1. Obtain a client token with the payment-request scope.
    const token = await getStitchClientToken([STITCH_PAYMENT_SCOPE])

    // 2. Build the mutation. `externalReference` is our CheckoutIntent id so
    //    the webhook correlates to the intent without trusting the browser.
    //    `payerReference`/`beneficiaryReference` are bank-statement references
    //    derived from the order number (sanitized + length-clamped to the
    //    documented limits). `amount.quantity` is in MAJOR units (Rand).
    const query = `mutation CreatePaymentRequest($input: ClientPaymentInitiationRequestCreateInput!) {
  clientPaymentInitiationRequestCreate(input: $input) {
    paymentInitiationRequest { id url }
  }
}`
    const variables = {
      input: {
        amount: {
          quantity: centsToStitchMajorUnits(input.amountCents),
          currency: input.currency.toUpperCase(),
        },
        payerReference: stitchReference(
          input.orderNumber,
          STITCH_PAYER_REFERENCE_MAX
        ),
        beneficiaryReference: stitchReference(
          input.orderNumber,
          STITCH_BENEFICIARY_REFERENCE_MAX
        ),
        externalReference: input.metadata.intentId,
        payerInformation: { payerId: input.customerEmail },
        expireAt: new Date(
          Date.now() + STITCH_REQUEST_EXPIRY_MINUTES * 60 * 1000
        ).toISOString(),
      },
    }

    // 3. POST to the GraphQL endpoint with Bearer auth + an idempotency key
    //    (the intent id) so a retried creation replays the original response
    //    instead of creating a second payment request.
    const res = await fetch(STITCH_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.metadata.intentId,
      },
      body: JSON.stringify({ query, variables }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Stitch session creation failed: ${res.status} ${text}`)
    }

    const payload = (await res.json()) as StitchCreateResponse

    // GraphQL returns HTTP 200 with an `errors` array on failure.
    if (payload.errors && payload.errors.length > 0) {
      const first = payload.errors[0]
      const code = first?.extensions?.code ?? "unknown"
      throw new Error(
        `Stitch session creation failed: ${code} ${first?.message ?? ""}`.trim()
      )
    }

    const request = payload.data?.clientPaymentInitiationRequestCreate
      ?.paymentInitiationRequest
    if (!request?.id) {
      throw new Error("Stitch response did not include a payment request id.")
    }
    if (!request.url) {
      throw new Error("Stitch response did not include a hosted payment url.")
    }

    // 4. Append the redirect URIs to the hosted url. `redirect_uri` receives
    //    successful completions; `failure_redirect_uri` receives closed/failed
    //    outcomes. The actual payment state is determined by the signed
    //    webhook, never the browser redirect.
    const redirectUrl = buildStitchRedirectUrl(
      request.url,
      input.successUrl,
      input.cancelUrl
    )

    return {
      provider: this.id,
      redirectUrl,
      providerReference: request.id,
    }
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
      amountMinor: majorUnitsToCents(amount?.quantity),
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
 * live network call). Used by `createSession` and exposed for webhook
 * subscription management.
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

// ── Pure helpers (exported for unit testing) ──────────────────────────

/**
 * Converts an amount in minor units (cents) to a Stitch `MoneyInput.quantity`
 * string in MAJOR units (Rand), formatted with 2 decimal places. Pure integer
 * math — no floating point — so the exact cents value round-trips.
 *
 *   11500 -> "115.00"   |   11523 -> "115.23"   |   5 -> "0.05"
 */
export function centsToStitchMajorUnits(cents: number): string {
  const rounded = Math.round(cents)
  const sign = rounded < 0 ? "-" : ""
  const abs = Math.abs(rounded)
  const whole = Math.floor(abs / 100)
  const frac = abs % 100
  return `${sign}${whole}.${frac.toString().padStart(2, "0")}`
}

/**
 * Converts a Stitch `amount.quantity` value (Decimal in MAJOR units / Rand,
 * string or number) back to minor units (cents). Returns 0 for a
 * missing/non-finite value — the authoritative-amount guard then fails
 * closed against the server-computed intent amount.
 *
 *   "115.00" -> 11500   |   "100.23" -> 10023   |   100 -> 10000
 */
export function majorUnitsToCents(
  quantity: string | number | null | undefined
): number {
  if (quantity === undefined || quantity === null) return 0
  const n = Number(quantity)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

/**
 * Builds a bank-statement reference from an arbitrary string (the order
 * number): keeps only alphanumerics, truncates to `maxLen` preserving the
 * unique trailing portion (so the suffix that distinguishes orders survives),
 * and falls back to a static placeholder when the input sanitizes to empty.
 *
 *   stitchReference("SN-20260831-000001", 12) -> "260831000001"
 *   stitchReference("SN-20260831-000001", 20) -> "SN20260831000001"
 */
export function stitchReference(value: string, maxLen: number): string {
  const sanitized = value.replace(/[^A-Za-z0-9]/g, "")
  if (sanitized.length === 0) {
    return "SHOPNOVA".slice(0, Math.max(1, maxLen))
  }
  if (sanitized.length <= maxLen) return sanitized
  // Preserve the trailing unique portion (order suffix).
  return sanitized.slice(sanitized.length - maxLen)
}

/**
 * Appends `redirect_uri` (and optional `failure_redirect_uri`) query
 * parameters to the Stitch hosted-payment `url`. Both values are URL-encoded.
 * The hosted url from Stitch has no query string, but this is robust to one
 * already being present.
 */
export function buildStitchRedirectUrl(
  hostedUrl: string,
  successUrl: string,
  cancelUrl?: string
): string {
  const sep = hostedUrl.includes("?") ? "&" : "?"
  const params = new URLSearchParams({ redirect_uri: successUrl })
  if (cancelUrl) {
    params.set("failure_redirect_uri", cancelUrl)
  }
  return `${hostedUrl}${sep}${params.toString()}`
}
