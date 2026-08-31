/**
 * ShopNova - Standard Webhooks verifier unit tests.
 *
 * Run with: node --import ./scripts/test-register.mjs --test --experimental-strip-types features/payment/standard-webhooks.test.ts
 *
 * Exercises the security-critical signature math shared by the Yoco and
 * Stitch (Svix) webhook verifiers, with no live credentials and no network.
 * The signer helper produces real HMAC-SHA256 vectors so the verifier is
 * tested against authentic signatures, not mocked ones.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"

import {
  signStandardWebhook,
  verifyStandardWebhook,
} from "./standard-webhooks.ts"

// A real Standard Webhooks secret: `whsec_` + base64-encoded random bytes.
const SECRET = "whsec_" + Buffer.from(randomBytes(32)).toString("base64")
const FIXED_NOW = 1_700_000_000
const TIMESTAMP = String(FIXED_NOW)

function headers(prefix: "webhook" | "svix", signature: string, id = "evt_1", timestamp = TIMESTAMP) {
  return {
    [`${prefix}-id`]: id,
    [`${prefix}-timestamp`]: timestamp,
    [`${prefix}-signature`]: signature,
  }
}

// ── Happy path ─────────────────────────────────

test("verifies a valid Yoco-style (webhook-*) signature", () => {
  const body = JSON.stringify({ id: "evt_1", type: "payment.succeeded", payload: {} })
  const signature = signStandardWebhook({ body, secret: SECRET, id: "evt_1", timestamp: TIMESTAMP })
  assert.equal(
    verifyStandardWebhook({
      body,
      headers: headers("webhook", signature),
      secret: SECRET,
      headerPrefix: "webhook",
      now: () => FIXED_NOW,
    }),
    true
  )
})

test("verifies a valid Svix/Stitch-style (svix-*) signature", () => {
  const body = JSON.stringify({ data: { client: { paymentInitiationRequests: { node: {} } } } })
  const signature = signStandardWebhook({ body, secret: SECRET, id: "msg_1", timestamp: TIMESTAMP })
  assert.equal(
    verifyStandardWebhook({
      body,
      headers: headers("svix", signature, "msg_1"),
      secret: SECRET,
      headerPrefix: "svix",
      now: () => FIXED_NOW,
    }),
    true
  )
})

test("the signed payload is id.timestamp.body (byte-exact); re-serialized JSON fails", () => {
  const original = JSON.stringify({ a: 1, b: 2 })
  const signature = signStandardWebhook({ body: original, secret: SECRET, id: "evt_x", timestamp: TIMESTAMP })
  // Re-serializing changes the byte order/spacing -> must fail.
  const reserialized = JSON.stringify({ b: 2, a: 1 })
  assert.notEqual(original, reserialized)
  assert.equal(
    verifyStandardWebhook({
      body: reserialized,
      headers: headers("webhook", signature, "evt_x"),
      secret: SECRET,
      headerPrefix: "webhook",
      now: () => FIXED_NOW,
    }),
    false
  )
})

// ── Signature failures ─────────────────────────

test("rejects an invalid signature", () => {
  const body = '{"id":"evt_1"}'
  assert.equal(
    verifyStandardWebhook({
      body,
      headers: headers("webhook", "v1,deadbeef="),
      secret: SECRET,
      headerPrefix: "webhook",
      now: () => FIXED_NOW,
    }),
    false
  )
})

test("rejects a signature signed with a different secret", () => {
  const otherSecret = "whsec_" + Buffer.from(randomBytes(32)).toString("base64")
  const body = '{"id":"evt_1"}'
  const signature = signStandardWebhook({ body, secret: otherSecret, id: "evt_1", timestamp: TIMESTAMP })
  assert.equal(
    verifyStandardWebhook({
      body,
      headers: headers("webhook", signature),
      secret: SECRET,
      headerPrefix: "webhook",
      now: () => FIXED_NOW,
    }),
    false
  )
})

test("rejects a missing signature header", () => {
  assert.equal(
    verifyStandardWebhook({
      body: "{}",
      headers: { "webhook-id": "evt_1", "webhook-timestamp": TIMESTAMP },
      secret: SECRET,
      headerPrefix: "webhook",
      now: () => FIXED_NOW,
    }),
    false
  )
})

test("rejects a missing id header", () => {
  assert.equal(
    verifyStandardWebhook({
      body: "{}",
      headers: { "webhook-timestamp": TIMESTAMP, "webhook-signature": "v1,x" },
      secret: SECRET,
      headerPrefix: "webhook",
      now: () => FIXED_NOW,
    }),
    false
  )
})

test("rejects a missing timestamp header", () => {
  assert.equal(
    verifyStandardWebhook({
      body: "{}",
      headers: { "webhook-id": "evt_1", "webhook-signature": "v1,x" },
      secret: SECRET,
      headerPrefix: "webhook",
      now: () => FIXED_NOW,
    }),
    false
  )
})

test("rejects a signature with no v1 entry (only v0/v2)", () => {
  const body = '{"id":"evt_1"}'
  const signature = signStandardWebhook({ body, secret: SECRET, id: "evt_1", timestamp: TIMESTAMP })
  const v1sig = signature.slice(3) // the base64 part
  // Replace the version prefix to simulate a non-v1 delivery.
  const nonV1 = `v2,${v1sig}`
  assert.equal(
    verifyStandardWebhook({
      body,
      headers: headers("webhook", nonV1),
      secret: SECRET,
      headerPrefix: "webhook",
      now: () => FIXED_NOW,
    }),
    false
  )
})

test("accepts a v1 entry alongside ignored v0/v2 entries (key rotation)", () => {
  const body = '{"id":"evt_1"}'
  const v1 = signStandardWebhook({ body, secret: SECRET, id: "evt_1", timestamp: TIMESTAMP })
  const rotated = `v0,deadbeef= ${v1} v2,cafef00d=`
  assert.equal(
    verifyStandardWebhook({
      body,
      headers: headers("webhook", rotated),
      secret: SECRET,
      headerPrefix: "webhook",
      now: () => FIXED_NOW,
    }),
    true
  )
})

// ── Replay protection ──────────────────────────

test("rejects a timestamp outside the tolerance window (replay)", () => {
  const body = '{"id":"evt_1"}'
  const signature = signStandardWebhook({ body, secret: SECRET, id: "evt_1", timestamp: TIMESTAMP })
  // Server clock is 10 minutes ahead -> 600s skew > 180s default tolerance.
  assert.equal(
    verifyStandardWebhook({
      body,
      headers: headers("webhook", signature),
      secret: SECRET,
      headerPrefix: "webhook",
      now: () => FIXED_NOW + 600,
    }),
    false
  )
})

test("accepts a timestamp within a widened tolerance window", () => {
  const body = '{"id":"evt_1"}'
  const signature = signStandardWebhook({ body, secret: SECRET, id: "evt_1", timestamp: TIMESTAMP })
  assert.equal(
    verifyStandardWebhook({
      body,
      headers: headers("webhook", signature),
      secret: SECRET,
      headerPrefix: "webhook",
      toleranceSeconds: 700,
      now: () => FIXED_NOW + 600,
    }),
    true
  )
})

test("rejects a tolerance above the 3600s hard maximum", () => {
  const body = '{"id":"evt_1"}'
  const signature = signStandardWebhook({ body, secret: SECRET, id: "evt_1", timestamp: TIMESTAMP })
  assert.equal(
    verifyStandardWebhook({
      body,
      headers: headers("webhook", signature),
      secret: SECRET,
      headerPrefix: "webhook",
      toleranceSeconds: 3601,
      now: () => FIXED_NOW,
    }),
    false
  )
})

test("rejects a non-numeric timestamp", () => {
  const body = '{"id":"evt_1"}'
  const signature = signStandardWebhook({ body, secret: SECRET, id: "evt_1", timestamp: TIMESTAMP })
  assert.equal(
    verifyStandardWebhook({
      body,
      headers: { "webhook-id": "evt_1", "webhook-timestamp": "not-a-number", "webhook-signature": signature },
      secret: SECRET,
      headerPrefix: "webhook",
      now: () => FIXED_NOW,
    }),
    false
  )
})

// ── Secret shape ───────────────────────────────

test("rejects a secret without the whsec_ prefix", () => {
  const body = '{"id":"evt_1"}'
  const rawSecret = Buffer.from(randomBytes(32)).toString("base64")
  // Sign with the prefixed secret, verify with the unprefixed one.
  const signature = signStandardWebhook({ body, secret: "whsec_" + rawSecret, id: "evt_1", timestamp: TIMESTAMP })
  assert.equal(
    verifyStandardWebhook({
      body,
      headers: headers("webhook", signature),
      secret: rawSecret,
      headerPrefix: "webhook",
      now: () => FIXED_NOW,
    }),
    false
  )
})

test("rejects a secret that base64-decodes to empty bytes", () => {
  const body = '{"id":"evt_1"}'
  assert.equal(
    verifyStandardWebhook({
      body,
      headers: headers("webhook", "v1,x"),
      secret: "whsec_",
      headerPrefix: "webhook",
      now: () => FIXED_NOW,
    }),
    false
  )
})

// ── Body guards ────────────────────────────────

test("rejects a body larger than 1 MiB", () => {
  const huge = "x".repeat(1_048_577)
  const signature = signStandardWebhook({ body: huge, secret: SECRET, id: "evt_1", timestamp: TIMESTAMP })
  assert.equal(
    verifyStandardWebhook({
      body: huge,
      headers: headers("webhook", signature),
      secret: SECRET,
      headerPrefix: "webhook",
      now: () => FIXED_NOW,
    }),
    false
  )
})

// ── Header-prefix isolation ────────────────────

test("a Yoco (webhook-*) signature does not verify under the svix prefix", () => {
  const body = '{"id":"evt_1"}'
  const signature = signStandardWebhook({ body, secret: SECRET, id: "evt_1", timestamp: TIMESTAMP })
  // Headers are webhook-* but the verifier looks for svix-* -> missing -> reject.
  assert.equal(
    verifyStandardWebhook({
      body,
      headers: headers("webhook", signature),
      secret: SECRET,
      headerPrefix: "svix",
      now: () => FIXED_NOW,
    }),
    false
  )
})
