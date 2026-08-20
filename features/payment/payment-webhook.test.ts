/**
 * ShopNova - Payment webhook verification unit tests.
 *
 * Run with: node --import ./scripts/test-register.mjs --test --experimental-strip-types features/payment/payment-webhook.test.ts
 *
 * Verifies the security-critical gateway callback behavior using the
 * REAL provider adapter code (no real credentials, no network):
 * - Invalid webhook signature is rejected.
 * - Missing webhook signature is rejected.
 * - Valid webhook/payment confirmation is accepted.
 * - A failed/unpaid payment is reported as not successful.
 *
 * Provider modules use `import "server-only"`; the test-register loader
 * shims that marker package so the adapters can be imported here.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { createHmac, createHash } from "node:crypto"

// ── Stripe ─────────────────────────────────────

async function importStripe() {
  process.env.STRIPE_SECRET_KEY = "sk_test_unit"
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_unit_secret"
  return import("./stripe.ts")
}

function stripeSignature(body: string, secret: string, timestamp = "1700000000"): string {
  const signed = `${timestamp}.${body}`
  const hash = createHmac("sha256", secret).update(signed).digest("hex")
  return `t=${timestamp},v1=${hash}`
}

test("Stripe: a valid signature is accepted and the notification is returned", async () => {
  const { StripeProvider } = await importStripe()
  const provider = new StripeProvider()
  assert.equal(provider.isConfigured(), true)

  const body = JSON.stringify({
    id: "evt_test_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_1",
        payment_status: "paid",
        amount_total: 11500,
        currency: "zar",
        metadata: { intentId: "intent-1" },
      },
    },
  })

  const notification = await provider.handleWebhook(
    body,
    { "stripe-signature": stripeSignature(body, "whsec_unit_secret") },
    {}
  )

  assert.equal(notification?.success, true)
  assert.equal(notification?.payloadKey, "evt_test_1")
  assert.equal(notification?.providerReference, "cs_test_1")
  assert.equal(notification?.intentId, "intent-1")
  assert.equal(notification?.amountMinor, 11500)
})

test("Stripe: an invalid signature is rejected", async () => {
  const { StripeProvider } = await importStripe()
  const provider = new StripeProvider()

  const body = JSON.stringify({ id: "evt_bad", type: "checkout.session.completed", data: { object: {} } })

  await assert.rejects(
    provider.handleWebhook(body, { "stripe-signature": "t=1,v1=deadbeef" }, {}),
    /Invalid Stripe signature/
  )
})

test("Stripe: a missing signature is rejected", async () => {
  const { StripeProvider } = await importStripe()
  const provider = new StripeProvider()

  await assert.rejects(
    provider.handleWebhook("{}", {}, {}),
    /Missing Stripe signature/
  )
})

test("Stripe: a failed payment event is reported as not successful", async () => {
  const { StripeProvider } = await importStripe()
  const provider = new StripeProvider()

  const body = JSON.stringify({
    id: "evt_test_2",
    type: "checkout.session.async_payment_failed",
    data: {
      object: {
        id: "cs_test_2",
        amount_total: 11500,
        currency: "zar",
        metadata: { intentId: "intent-2" },
      },
    },
  })

  const notification = await provider.handleWebhook(
    body,
    { "stripe-signature": stripeSignature(body, "whsec_unit_secret") },
    {}
  )

  assert.equal(notification?.success, false)
  assert.equal(notification?.errorCode, "stripe:payment_failed")
})

test("Stripe: an unhandled event type returns null (ignored, not an error)", async () => {
  const { StripeProvider } = await importStripe()
  const provider = new StripeProvider()

  const body = JSON.stringify({
    id: "evt_test_3",
    type: "product.updated",
    data: { object: {} },
  })

  const notification = await provider.handleWebhook(
    body,
    { "stripe-signature": stripeSignature(body, "whsec_unit_secret") },
    {}
  )

  assert.equal(notification, null)
})

// ── PayFast ────────────────────────────────────

async function importPayFast() {
  process.env.PAYFAST_MERCHANT_ID = "10000100"
  process.env.PAYFAST_MERCHANT_KEY = "46f0cd694581a"
  process.env.PAYFAST_PASSPHRASE = "shopnova-test-pass"
  process.env.PAYFAST_TEST_MODE = "true"
  return import("./payfast.ts")
}

test("PayFast: a valid signature is accepted and a COMPLETE payment is successful", async () => {
  const { PayFastProvider, signPayFast } = await importPayFast()
  const provider = new PayFastProvider()
  assert.equal(provider.isConfigured(), true)

  const fields: Record<string, string> = {
    m_payment_id: "intent-pf-1",
    pf_payment_id: "pf_pay_1",
    payment_status: "COMPLETE",
    amount_gross: "115.00",
    currency: "ZAR",
    item_name: "ShopNova Order SN-20260818-000001",
  }
  const signature = signPayFast(fields)
  const body = new URLSearchParams({ ...fields, signature }).toString()

  const notification = await provider.handleWebhook(body, {}, {})

  assert.equal(notification?.success, true)
  assert.equal(notification?.payloadKey, "pf:pf_pay_1")
  assert.equal(notification?.intentId, "intent-pf-1")
  assert.equal(notification?.amountMinor, 11500)
})

test("PayFast: an invalid signature is rejected", async () => {
  const { PayFastProvider } = await importPayFast()
  const provider = new PayFastProvider()

  const body = new URLSearchParams({
    m_payment_id: "intent-pf-2",
    pf_payment_id: "pf_pay_2",
    payment_status: "COMPLETE",
    amount_gross: "115.00",
    signature: "deadbeef",
  }).toString()

  await assert.rejects(provider.handleWebhook(body, {}, {}), /Invalid PayFast signature/)
})

test("PayFast: a missing signature is rejected", async () => {
  const { PayFastProvider } = await importPayFast()
  const provider = new PayFastProvider()

  const body = new URLSearchParams({
    m_payment_id: "intent-pf-3",
    payment_status: "COMPLETE",
  }).toString()

  await assert.rejects(provider.handleWebhook(body, {}, {}), /Missing PayFast signature/)
})

test("PayFast: a non-COMPLETE payment is reported as not successful", async () => {
  const { PayFastProvider, signPayFast } = await importPayFast()
  const provider = new PayFastProvider()

  const fields: Record<string, string> = {
    m_payment_id: "intent-pf-4",
    pf_payment_id: "pf_pay_4",
    payment_status: "FAILED",
    amount_gross: "115.00",
  }
  const signature = signPayFast(fields)
  const body = new URLSearchParams({ ...fields, signature }).toString()

  const notification = await provider.handleWebhook(body, {}, {})

  assert.equal(notification?.success, false)
  assert.equal(notification?.errorCode, "payfast:payment_failed")
})

test("PayFast: signature is stable and matches the documented MD5 over sorted fields + passphrase", async () => {
  const { signPayFast } = await importPayFast()
  const fields = {
    m_payment_id: "x",
    amount_gross: "10.00",
    payment_status: "COMPLETE",
  }
  const expected = createHash("md5")
    .update("passphrase=shopnova-test-pass&amount_gross=10.00&m_payment_id=x&payment_status=COMPLETE")
    .digest("hex")
  assert.equal(signPayFast(fields), expected)
})

// ── Test gateway ───────────────────────────────

async function importTestProvider() {
  process.env.TEST_PAYMENT_SECRET = "test-unit-secret"
  return import("./test.ts")
}

function testSignature(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex")
}

test("Test gateway: a valid signature is accepted and a success notification is returned", async () => {
  const { TestProvider } = await importTestProvider()
  const provider = new TestProvider()
  assert.equal(provider.isConfigured(), true)

  const body = JSON.stringify({
    intentId: "intent-test-1",
    success: true,
    amountMinor: 11500,
    currency: "zar",
    eventId: "evt-test-1",
  })

  const notification = await provider.handleWebhook(
    body,
    { "x-test-signature": testSignature(body, "test-unit-secret") },
    {}
  )

  assert.equal(notification?.success, true)
  assert.equal(notification?.payloadKey, "evt-test-1")
  assert.equal(notification?.intentId, "intent-test-1")
  assert.equal(notification?.amountMinor, 11500)
})

test("Test gateway: an invalid signature is rejected", async () => {
  const { TestProvider } = await importTestProvider()
  const provider = new TestProvider()

  await assert.rejects(
    provider.handleWebhook("{}", { "x-test-signature": "deadbeef" }, {}),
    /Invalid test payment signature/
  )
})

test("Test gateway: a missing signature is rejected", async () => {
  const { TestProvider } = await importTestProvider()
  const provider = new TestProvider()

  await assert.rejects(provider.handleWebhook("{}", {}, {}), /Missing test payment signature/)
})

test("Test gateway: a failed payment is reported as not successful", async () => {
  const { TestProvider } = await importTestProvider()
  const provider = new TestProvider()

  const body = JSON.stringify({
    intentId: "intent-test-2",
    success: false,
    amountMinor: 11500,
    currency: "zar",
    eventId: "evt-test-2",
  })

  const notification = await provider.handleWebhook(
    body,
    { "x-test-signature": testSignature(body, "test-unit-secret") },
    {}
  )

  assert.equal(notification?.success, false)
  assert.equal(notification?.errorCode, "declined")
})
