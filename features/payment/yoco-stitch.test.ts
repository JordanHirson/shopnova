/**
 * ShopNova - Yoco + Stitch payment-provider unit tests.
 *
 * Run with: node --import ./scripts/test-register.mjs --test --experimental-strip-types features/payment/yoco-stitch.test.ts
 *
 * Verifies the new provider adapters using REAL signature math (no live
 * credentials, no network for webhooks). `createSession` is exercised with a
 * mocked `fetch` so the request/response contract is tested without hitting
 * the live Yoco API. Provider modules use `import "server-only"`; the
 * test-register loader shims that marker package so they import here.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"

import { signStandardWebhook } from "./standard-webhooks.ts"

const WEBHOOK_SECRET = "whsec_" + Buffer.from(randomBytes(32)).toString("base64")
// The adapters verify with the real clock (no injectable now), so signatures
// must be stamped with the current time to pass the replay-protection window.
const NOW_SECONDS = Math.floor(Date.now() / 1000)
const TIMESTAMP = String(NOW_SECONDS)

function webhookHeaders(prefix: "webhook" | "svix", signature: string, id = "evt_1") {
  return {
    [`${prefix}-id`]: id,
    [`${prefix}-timestamp`]: TIMESTAMP,
    [`${prefix}-signature`]: signature,
  }
}

/** A minimal PaymentOrder used to exercise createSession. */
function sampleOrder(intentId = "intent-1") {
  return {
    orderNumber: "SN-20260830-000001",
    amountCents: 11500,
    currency: "zar" as const,
    customerEmail: "shopper@example.com",
    successUrl: "https://example.com/checkout/success?orderNumber=SN-20260830-000001",
    cancelUrl: "https://example.com/checkout?canceled=1",
    notifyUrl: "https://example.com/api/webhooks/yoco",
    metadata: { intentId, provider: "yoco" as const },
  }
}

// ── Yoco ───────────────────────────────────────

async function importYoco() {
  process.env.YOCO_SECRET_KEY = "sk_test_unit"
  process.env.YOCO_WEBHOOK_SECRET = WEBHOOK_SECRET
  return import("./yoco.ts")
}

function yocoSignedBody(payload: object, id = "evt_1") {
  const body = JSON.stringify({ id, type: "payment.succeeded", payload })
  const signature = signStandardWebhook({ body, secret: WEBHOOK_SECRET, id, timestamp: TIMESTAMP })
  return { body, signature }
}

test("Yoco: isConfigured is true when both secrets are present", async () => {
  const { YocoProvider } = await importYoco()
  assert.equal(new YocoProvider().isConfigured(), true)
})

test("Yoco: createSession posts to /checkouts and returns the hosted redirect URL", async () => {
  const { YocoProvider } = await importYoco()
  const provider = new YocoProvider()
  const originalFetch = globalThis.fetch

  let capturedUrl = ""
  let capturedInit: RequestInit | undefined
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    capturedUrl = typeof input === "string" ? input : input.toString()
    capturedInit = init
    return new Response(JSON.stringify({ id: "chk_abc", redirectUrl: "https://payments.yoco.com/checkout/chk_abc" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }) as typeof fetch

  try {
    const session = await provider.createSession(sampleOrder("intent-yoco-1"))
    assert.equal(session.provider, "yoco")
    assert.equal(session.redirectUrl, "https://payments.yoco.com/checkout/chk_abc")
    assert.equal(session.providerReference, "chk_abc")

    // Request contract: hosted-checkout endpoint, Bearer auth, JSON body.
    assert.match(capturedUrl, /https:\/\/payments\.yoco\.com\/api\/checkouts$/)
    const headers = new Headers(capturedInit!.headers as HeadersInit)
    assert.equal(headers.get("Authorization"), "Bearer sk_test_unit")
    assert.equal(headers.get("Content-Type"), "application/json")
    assert.equal(headers.get("Idempotency-Key"), "intent-yoco-1")

    const body = JSON.parse(String(capturedInit!.body))
    assert.equal(body.amount, 11500)
    assert.equal(body.currency, "ZAR") // uppercased ISO code
    assert.equal(body.successUrl, sampleOrder("intent-yoco-1").successUrl)
    assert.equal(body.metadata.intentId, "intent-yoco-1")
    assert.equal(body.metadata.provider, "yoco")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("Yoco: createSession throws when the API returns a non-OK status", async () => {
  const { YocoProvider } = await importYoco()
  const provider = new YocoProvider()
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response('{"errorType":"invalid_request"}', { status: 400 })) as typeof fetch

  try {
    await assert.rejects(provider.createSession(sampleOrder()), /Yoco session creation failed: 400/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("Yoco: createSession throws when the response has no redirectUrl", async () => {
  const { YocoProvider } = await importYoco()
  const provider = new YocoProvider()
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ id: "chk_1", redirectUrl: null }), { status: 200 })) as typeof fetch

  try {
    await assert.rejects(provider.createSession(sampleOrder()), /without a redirect URL/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("Yoco: a valid payment.succeeded webhook returns a success notification", async () => {
  const { YocoProvider } = await importYoco()
  const provider = new YocoProvider()

  const { body, signature } = yocoSignedBody({
    id: "pay_1",
    amount: 11500,
    currency: "ZAR",
    metadata: { intentId: "intent-yoco-2" },
  })

  const notification = await provider.handleWebhook(body, webhookHeaders("webhook", signature), {})
  assert.equal(notification?.success, true)
  assert.equal(notification?.payloadKey, "evt_1")
  assert.equal(notification?.providerReference, "pay_1")
  assert.equal(notification?.intentId, "intent-yoco-2")
  assert.equal(notification?.amountMinor, 11500)
  assert.equal(notification?.currency, "zar")
  assert.equal(notification?.errorCode, undefined)
})

test("Yoco: a payment.failed webhook is reported as not successful", async () => {
  const { YocoProvider } = await importYoco()
  const provider = new YocoProvider()

  const body = JSON.stringify({
    id: "evt_fail",
    type: "payment.failed",
    payload: { id: "pay_fail", amount: 11500, currency: "zar", metadata: { intentId: "intent-yoco-3" } },
  })
  const signature = signStandardWebhook({ body, secret: WEBHOOK_SECRET, id: "evt_fail", timestamp: TIMESTAMP })

  const notification = await provider.handleWebhook(body, webhookHeaders("webhook", signature, "evt_fail"), {})
  assert.equal(notification?.success, false)
  assert.equal(notification?.errorCode, "yoco:payment_failed")
  assert.equal(notification?.intentId, "intent-yoco-3")
})

test("Yoco: an unhandled event type returns null (ignored, not an error)", async () => {
  const { YocoProvider } = await importYoco()
  const provider = new YocoProvider()

  const body = JSON.stringify({ id: "evt_refund", type: "refund.succeeded", payload: {} })
  const signature = signStandardWebhook({ body, secret: WEBHOOK_SECRET, id: "evt_refund", timestamp: TIMESTAMP })

  const notification = await provider.handleWebhook(body, webhookHeaders("webhook", signature, "evt_refund"), {})
  assert.equal(notification, null)
})

test("Yoco: an invalid signature is rejected", async () => {
  const { YocoProvider } = await importYoco()
  const provider = new YocoProvider()

  await assert.rejects(
    provider.handleWebhook('{"id":"evt_1","type":"payment.succeeded"}', webhookHeaders("webhook", "v1,deadbeef="), {}),
    /Invalid Yoco signature/
  )
})

test("Yoco: a missing signature is rejected", async () => {
  const { YocoProvider } = await importYoco()
  const provider = new YocoProvider()

  await assert.rejects(
    provider.handleWebhook("{}", { "webhook-id": "evt_1", "webhook-timestamp": TIMESTAMP }, {}),
    /Invalid Yoco signature/
  )
})

test("Yoco: a replayed (stale) webhook is rejected", async () => {
  const { YocoProvider } = await importYoco()
  const provider = new YocoProvider()

  const { body } = yocoSignedBody({ id: "pay_1", amount: 11500, metadata: { intentId: "i" } })
  // Sign with a timestamp 1 hour in the past -> outside the 180s tolerance.
  const oldTs = String(NOW_SECONDS - 3600)
  const oldSig = signStandardWebhook({ body, secret: WEBHOOK_SECRET, id: "evt_1", timestamp: oldTs })
  await assert.rejects(
    provider.handleWebhook(
      body,
      { "webhook-id": "evt_1", "webhook-timestamp": oldTs, "webhook-signature": oldSig },
      {}
    ),
    /Invalid Yoco signature/
  )
})

test("Yoco: a malformed (non-JSON) body is rejected after signature check", async () => {
  const { YocoProvider } = await importYoco()
  const provider = new YocoProvider()

  // The signature is valid over the raw body, but the body is not JSON.
  const body = "not-json"
  const signature = signStandardWebhook({ body, secret: WEBHOOK_SECRET, id: "evt_1", timestamp: TIMESTAMP })
  await assert.rejects(
    provider.handleWebhook(body, webhookHeaders("webhook", signature), {}),
    SyntaxError
  )
})

test("Yoco: a wrong-provider intent id in metadata is passed through (provider-match enforced downstream)", async () => {
  // The adapter only extracts the intent id from verified metadata; the
  // provider-match boundary (intent.provider === webhook provider) is
  // enforced inside completePaidIntent via isProviderMatch. Here we confirm
  // the adapter surfaces the metadata intent id unchanged so a downstream
  // Stripe intent would be rejected as provider-mismatch.
  const { YocoProvider } = await importYoco()
  const provider = new YocoProvider()

  const { body, signature } = yocoSignedBody({
    id: "pay_1",
    amount: 11500,
    metadata: { intentId: "intent-created-for-stripe" },
  })

  const notification = await provider.handleWebhook(body, webhookHeaders("webhook", signature), {})
  assert.equal(notification?.intentId, "intent-created-for-stripe")
  assert.equal(notification?.success, true)
})

// ── Stitch ─────────────────────────────────────

async function importStitch() {
  process.env.STITCH_CLIENT_ID = "stitch_client_unit"
  process.env.STITCH_CLIENT_SECRET = "stitch_secret_unit"
  process.env.STITCH_WEBHOOK_SECRET = WEBHOOK_SECRET
  return import("./stitch.ts")
}

/**
 * Imports the Stitch module fresh (cache-busted) with a given env overlay so
 * the module-level `process.env` reads re-run. Used to exercise the
 * not-configured paths — the provider captures credentials at module load,
 * matching Yoco, so post-import env mutation would not be observed.
 */
async function importStitchFresh(env: Record<string, string | undefined>) {
  const saved = { ...process.env }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  try {
    const url = new URL(`./stitch.ts?fresh=${Math.random()}`, import.meta.url)
    return (await import(url.href)) as typeof import("./stitch.ts")
  } finally {
    process.env = saved
  }
}

function stitchEventBody(overrides: {
  state?: string
  externalReference?: string
  amount?: { currency?: string; quantity?: string | number }
  id?: string
} = {}) {
  const node = {
    __typename: "PaymentInitiationRequest",
    id: overrides.id ?? "cGF5cmVxLzEyMw==",
    externalReference: overrides.externalReference ?? "intent-stitch-1",
    currency: "ZAR",
    // Stitch `amount.quantity` is a Decimal in MAJOR units (Rand), not cents.
    // R115.00 == 11500 cents (matches the sample order amountCents).
    amount: overrides.amount ?? { currency: "ZAR", quantity: "115.00" },
    state: { __typename: overrides.state ?? "PaymentInitiationRequestCompleted" },
  }
  return JSON.stringify({
    data: { client: { paymentInitiationRequests: { node } } },
  })
}

function stitchSigned(body: string, id = "msg_1") {
  const signature = signStandardWebhook({ body, secret: WEBHOOK_SECRET, id, timestamp: TIMESTAMP })
  return webhookHeaders("svix", signature, id)
}

test("Stitch: isConfigured is true when all credentials are present", async () => {
  const { StitchProvider } = await importStitch()
  assert.equal(new StitchProvider().isConfigured(), true)
})

test("Stitch: isConfigured is false when any credential is missing", async () => {
  const base = {
    STITCH_CLIENT_ID: "stitch_client_unit",
    STITCH_CLIENT_SECRET: "stitch_secret_unit",
    STITCH_WEBHOOK_SECRET: WEBHOOK_SECRET,
  }
  for (const missing of Object.keys(base)) {
    const env = { ...base, [missing]: undefined }
    const { StitchProvider } = await importStitchFresh(env)
    assert.equal(
      new StitchProvider().isConfigured(),
      false,
      `isConfigured should be false when ${missing} is missing`
    )
  }
})

test("Stitch: createSession posts the GraphQL mutation and returns the hosted url with redirect params", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()
  const originalFetch = globalThis.fetch

  let capturedUrl = ""
  let capturedInit: RequestInit | undefined
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    // The first call is the OAuth token request; the second is the GraphQL
    // mutation. Capture the GraphQL call (the one whose body is JSON with a
    // `query` field).
    const body = init?.body
    if (typeof body === "string" && body.includes("clientPaymentInitiationRequestCreate")) {
      capturedUrl = typeof input === "string" ? input : input.toString()
      capturedInit = init
      return new Response(
        JSON.stringify({
          data: {
            clientPaymentInitiationRequestCreate: {
              paymentInitiationRequest: {
                id: "cGF5cmVxLzEyMw==",
                url: "https://secure.stitch.money/connect/payment-request/abc-123",
              },
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }
    // Token endpoint.
    return new Response(JSON.stringify({ access_token: "tok_unit" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }) as typeof fetch

  try {
    const order = sampleOrder("intent-stitch-create")
    // Stitch is SA Pay By Bank; point the notify url at the stitch webhook.
    order.notifyUrl = "https://example.com/api/webhooks/stitch"
    const session = await provider.createSession(order)

    assert.equal(session.provider, "stitch")
    assert.equal(session.providerReference, "cGF5cmVxLzEyMw==")

    // redirect_uri (success) + failure_redirect_uri (cancel) appended.
    assert.match(session.redirectUrl, /^https:\/\/secure\.stitch\.money\/connect\/payment-request\/abc-123\?/)
    assert.match(session.redirectUrl, /redirect_uri=https%3A%2F%2Fexample\.com%2Fcheckout%2Fsuccess/)
    assert.match(session.redirectUrl, /failure_redirect_uri=https%3A%2F%2Fexample\.com%2Fcheckout%3Fcanceled%3D1/)

    // GraphQL request contract.
    assert.equal(capturedUrl, "https://api.stitch.money/graphql")
    const headers = new Headers(capturedInit!.headers as HeadersInit)
    assert.equal(headers.get("Authorization"), "Bearer tok_unit")
    assert.equal(headers.get("Content-Type"), "application/json")
    assert.equal(headers.get("Idempotency-Key"), "intent-stitch-create")

    const body = JSON.parse(String(capturedInit!.body))
    assert.match(body.query, /clientPaymentInitiationRequestCreate\(input: \$input\)/)
    assert.match(body.query, /paymentInitiationRequest \{ id url \}/)

    const input = body.variables.input
    // Amount in MAJOR units (Rand), not cents.
    assert.equal(input.amount.quantity, "115.00")
    assert.equal(input.amount.currency, "ZAR")
    // externalReference is the intent id (webhook correlation key).
    assert.equal(input.externalReference, "intent-stitch-create")
    // Bank-statement references within documented limits.
    assert.ok(input.payerReference.length <= 12, "payerReference <= 12 chars")
    assert.ok(input.beneficiaryReference.length <= 20, "beneficiaryReference <= 20 chars")
    // payerId recommended for fraud checks.
    assert.equal(input.payerInformation.payerId, "shopper@example.com")
    // expireAt is an ISO 8601 datetime.
    assert.ok(!Number.isNaN(Date.parse(input.expireAt)))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("Stitch: createSession throws on a non-OK HTTP response", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const body = init?.body
    if (typeof body === "string" && body.includes("clientPaymentInitiationRequestCreate")) {
      return new Response('{"error":"bad"}', { status: 502 })
    }
    return new Response(JSON.stringify({ access_token: "tok_unit" }), { status: 200 })
  }) as typeof fetch

  try {
    await assert.rejects(provider.createSession(sampleOrder()), /Stitch session creation failed: 502/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("Stitch: createSession throws on a GraphQL errors array", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const body = init?.body
    if (typeof body === "string" && body.includes("clientPaymentInitiationRequestCreate")) {
      return new Response(
        JSON.stringify({
          data: null,
          errors: [
            {
              message: "This idempotency key has already been used for a different request.",
              extensions: { code: "IDEMPOTENCY_KEY_ALREADY_USED" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }
    return new Response(JSON.stringify({ access_token: "tok_unit" }), { status: 200 })
  }) as typeof fetch

  try {
    await assert.rejects(
      provider.createSession(sampleOrder()),
      /IDEMPOTENCY_KEY_ALREADY_USED/
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("Stitch: createSession throws when the response has no payment request id", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const body = init?.body
    if (typeof body === "string" && body.includes("clientPaymentInitiationRequestCreate")) {
      return new Response(
        JSON.stringify({
          data: { clientPaymentInitiationRequestCreate: { paymentInitiationRequest: { id: "", url: "https://x" } } },
        }),
        { status: 200 }
      )
    }
    return new Response(JSON.stringify({ access_token: "tok_unit" }), { status: 200 })
  }) as typeof fetch

  try {
    await assert.rejects(provider.createSession(sampleOrder()), /did not include a payment request id/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("Stitch: createSession throws when the response has no hosted url", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const body = init?.body
    if (typeof body === "string" && body.includes("clientPaymentInitiationRequestCreate")) {
      return new Response(
        JSON.stringify({
          data: { clientPaymentInitiationRequestCreate: { paymentInitiationRequest: { id: "id_1", url: "" } } },
        }),
        { status: 200 }
      )
    }
    return new Response(JSON.stringify({ access_token: "tok_unit" }), { status: 200 })
  }) as typeof fetch

  try {
    await assert.rejects(provider.createSession(sampleOrder()), /did not include a hosted payment url/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("Stitch: createSession refuses when not configured", async () => {
  const { StitchProvider } = await importStitchFresh({
    STITCH_CLIENT_ID: undefined,
    STITCH_CLIENT_SECRET: "stitch_secret_unit",
    STITCH_WEBHOOK_SECRET: WEBHOOK_SECRET,
  })
  await assert.rejects(new StitchProvider().createSession(sampleOrder()), /Stitch is not configured/)
})

// ── Stitch pure helpers ─────────────────────────

test("Stitch centsToStitchMajorUnits: cents -> major-unit Decimal string", async () => {
  const { centsToStitchMajorUnits } = await importStitch()
  assert.equal(centsToStitchMajorUnits(11500), "115.00")
  assert.equal(centsToStitchMajorUnits(11523), "115.23")
  assert.equal(centsToStitchMajorUnits(5), "0.05")
  assert.equal(centsToStitchMajorUnits(0), "0.00")
  assert.equal(centsToStitchMajorUnits(100), "1.00")
  // Rounds half-up on bad input.
  assert.equal(centsToStitchMajorUnits(11500.4), "115.00")
  assert.equal(centsToStitchMajorUnits(11500.6), "115.01")
})

test("Stitch majorUnitsToCents: major-unit Decimal -> cents (round trip)", async () => {
  const { majorUnitsToCents, centsToStitchMajorUnits } = await importStitch()
  assert.equal(majorUnitsToCents("115.00"), 11500)
  assert.equal(majorUnitsToCents("100.23"), 10023)
  assert.equal(majorUnitsToCents(100), 10000)
  assert.equal(majorUnitsToCents("0.05"), 5)
  // Missing / non-finite -> 0 (guard fails closed downstream).
  assert.equal(majorUnitsToCents(undefined), 0)
  assert.equal(majorUnitsToCents(null), 0)
  assert.equal(majorUnitsToCents("not-a-number"), 0)
  // Round trip preserves the exact cents value.
  for (const cents of [0, 1, 5, 99, 100, 11500, 11523, 999999]) {
    assert.equal(majorUnitsToCents(centsToStitchMajorUnits(cents)), cents)
  }
})

test("Stitch stitchReference: sanitizes + truncates within documented limits", async () => {
  const { stitchReference } = await importStitch()
  const order = "SN-20260831-000001"
  // Alphanumeric only; fits within 20.
  assert.equal(stitchReference(order, 20), "SN20260831000001")
  // Truncated to 12 preserves the unique trailing suffix.
  assert.equal(stitchReference(order, 12), "260831000001")
  assert.equal(stitchReference(order, 12).length, 12)
  // Short input is kept as-is.
  assert.equal(stitchReference("A1", 12), "A1")
  // Empty / non-alphanumeric input falls back to a static placeholder.
  assert.equal(stitchReference("---", 12), "SHOPNOVA")
  assert.equal(stitchReference("", 8), "SHOPNOVA")
})

test("Stitch buildStitchRedirectUrl: appends encoded redirect + failure params", async () => {
  const { buildStitchRedirectUrl } = await importStitch()
  const out = buildStitchRedirectUrl(
    "https://secure.stitch.money/connect/payment-request/abc",
    "https://example.com/checkout/success?orderNumber=SN-1",
    "https://example.com/checkout?canceled=1"
  )
  assert.match(out, /^https:\/\/secure\.stitch\.money\/connect\/payment-request\/abc\?/)
  assert.match(out, /redirect_uri=https%3A%2F%2Fexample\.com%2Fcheckout%2Fsuccess%3ForderNumber%3DSN-1/)
  assert.match(out, /failure_redirect_uri=https%3A%2F%2Fexample\.com%2Fcheckout%3Fcanceled%3D1/)
  // Without a cancel url, only redirect_uri is appended.
  const out2 = buildStitchRedirectUrl("https://x/y", "https://example.com/s")
  assert.match(out2, /\?redirect_uri=/)
  assert.doesNotMatch(out2, /failure_redirect_uri/)
  // A url that already has a query string uses '&' not '?'.
  const out3 = buildStitchRedirectUrl("https://x/y?z=1", "https://example.com/s")
  assert.match(out3, /\?z=1&redirect_uri=/)
})

test("Stitch: a valid PaymentInitiationRequestCompleted webhook returns a success notification", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()

  const body = stitchEventBody({ state: "PaymentInitiationRequestCompleted" })
  const notification = await provider.handleWebhook(body, stitchSigned(body), {})

  assert.equal(notification?.success, true)
  assert.equal(notification?.intentId, "intent-stitch-1")
  assert.equal(notification?.amountMinor, 11500)
  assert.equal(notification?.currency, "zar")
  assert.equal(notification?.errorCode, undefined)
  // The Svix message id is the idempotency key.
  assert.equal(notification?.payloadKey, "msg_1")
})

test("Stitch: a Cancelled state is reported as not successful", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()

  const body = stitchEventBody({ state: "PaymentInitiationRequestCancelled" })
  const notification = await provider.handleWebhook(body, stitchSigned(body), {})

  assert.equal(notification?.success, false)
  assert.equal(notification?.errorCode, "stitch:payment_failed")
})

test("Stitch: an Expired state is reported as not successful", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()

  const body = stitchEventBody({ state: "PaymentInitiationRequestExpired" })
  const notification = await provider.handleWebhook(body, stitchSigned(body), {})

  assert.equal(notification?.success, false)
  assert.equal(notification?.errorCode, "stitch:payment_failed")
})

test("Stitch: a Pending (non-final) state is ignored (null)", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()

  const body = stitchEventBody({ state: "PaymentInitiationRequestPending" })
  const notification = await provider.handleWebhook(body, stitchSigned(body), {})
  assert.equal(notification, null)
})

test("Stitch: an invalid Svix signature is rejected", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()

  await assert.rejects(
    provider.handleWebhook(stitchEventBody(), webhookHeaders("svix", "v1,deadbeef="), {}),
    /Invalid Stitch signature/
  )
})

test("Stitch: a missing signature is rejected", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()

  await assert.rejects(
    provider.handleWebhook("{}", { "svix-id": "msg_1", "svix-timestamp": TIMESTAMP }, {}),
    /Invalid Stitch signature/
  )
})

test("Stitch: a Yoco-style (webhook-*) signature does not verify under the svix prefix", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()

  const body = stitchEventBody()
  // Sign with the Stitch secret but present the signature under webhook-* headers.
  const signature = signStandardWebhook({ body, secret: WEBHOOK_SECRET, id: "msg_1", timestamp: TIMESTAMP })
  await assert.rejects(
    provider.handleWebhook(body, webhookHeaders("webhook", signature, "msg_1"), {}),
    /Invalid Stitch signature/
  )
})

test("Stitch: a delivery without a payment-initiation node is ignored", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()

  const body = JSON.stringify({ data: { client: { refunds: { node: { id: "r_1" } } } } })
  const notification = await provider.handleWebhook(body, stitchSigned(body), {})
  assert.equal(notification, null)
})

test("Stitch: amount quantity (major units / Rand) is converted to cents", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()

  // R19.99 -> 1999 cents.
  const body = stitchEventBody({ amount: { currency: "ZAR", quantity: "19.99" } })
  const notification = await provider.handleWebhook(body, stitchSigned(body), {})
  assert.equal(notification?.amountMinor, 1999)
})

test("Stitch: a malformed (non-JSON) body is rejected after signature check", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()

  const body = "not-json"
  const signature = signStandardWebhook({ body, secret: WEBHOOK_SECRET, id: "msg_1", timestamp: TIMESTAMP })
  await assert.rejects(
    provider.handleWebhook(body, webhookHeaders("svix", signature, "msg_1"), {}),
    SyntaxError
  )
})

test("Stitch: a wrong-provider intent (externalReference) is passed through for downstream provider-match", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()

  const body = stitchEventBody({ externalReference: "intent-created-for-yoco" })
  const notification = await provider.handleWebhook(body, stitchSigned(body), {})
  assert.equal(notification?.intentId, "intent-created-for-yoco")
})

test("Stitch: duplicate deliveries share the Svix message id (idempotency key)", async () => {
  const { StitchProvider } = await importStitch()
  const provider = new StitchProvider()

  const body = stitchEventBody()
  // Same svix-id -> same payloadKey -> downstream completePaidIntent dedupes.
  const n1 = await provider.handleWebhook(body, stitchSigned(body, "msg_dup"), {})
  const n2 = await provider.handleWebhook(body, stitchSigned(body, "msg_dup"), {})
  assert.equal(n1?.payloadKey, "msg_dup")
  assert.equal(n2?.payloadKey, "msg_dup")
})
