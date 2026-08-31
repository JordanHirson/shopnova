/**
 * ShopNova - Standard Webhooks signature verification.
 *
 * A small, dependency-free (Node `crypto` only) implementation of the
 * Standard Webhooks specification (https://www.standardwebhooks.com/).
 *
 * Both Yoco and Stitch deliver signed webhooks using this exact scheme:
 *  - Yoco sends the `webhook-id`, `webhook-timestamp`, `webhook-signature`
 *    headers.
 *  - Stitch delivers via Svix, which sends the `svix-id`, `svix-timestamp`,
 *    `svix-signature` headers.
 *
 * The verification algorithm is identical for both — only the header-name
 * prefix differs. Keeping it in one pure, unit-tested module avoids two
 * near-duplicate verifiers and guarantees the security-critical signature
 * math is exercised by the test suite without live credentials.
 *
 * SECURITY:
 * - The shared signing secret always starts with `whsec_`; the bytes after
 *   the prefix are base64-encoded and MUST be decoded before HMAC.
 * - The signed payload is `id + "." + timestamp + "." + body` where `body`
 *   is the RAW request body (byte-for-byte). Re-serialized JSON never
 *   matches.
 * - Signatures are compared in constant time; the `webhook-signature` /
 *   `svix-signature` header is a space-separated list of versioned
 *   signatures (`v1,<base64>`). Only `v1` entries are accepted; other
 *   versions are ignored so key rotation does not break verification.
 * - Replay protection: a delivery whose timestamp falls outside the
 *   tolerance window is rejected. Default 180s, hard max 3600s (per the
 *   Standard Webhooks spec / Svix).
 *
 * This module is intentionally pure (no `server-only`) so it can be imported
 * directly by Node's native test runner.
 */
import { createHmac, timingSafeEqual } from "crypto"

/** Header-name prefix used by the delivering service. */
export type StandardWebhookHeaderPrefix = "webhook" | "svix"

const SECRET_PREFIX = "whsec_"
const DEFAULT_TOLERANCE_SECONDS = 180
const MAX_TOLERANCE_SECONDS = 3600
/** Defends against pathological payloads before any parsing begins. */
const MAX_BODY_BYTES = 1_048_576

export interface VerifyStandardWebhookInput {
  /** Raw, unmodified request body (the exact bytes the sender signed). */
  body: string
  /** Request headers with lowercased keys (see `normalizeHeaders`). */
  headers: Record<string, string>
  /** The `whsec_…` signing secret for this webhook subscription. */
  secret: string
  /** `webhook` for Yoco, `svix` for Stitch. */
  headerPrefix: StandardWebhookHeaderPrefix
  /** Allowed clock skew in seconds. Defaults to 180; max 3600. */
  toleranceSeconds?: number
  /** Injectable clock (unix seconds) for deterministic tests. */
  now?: () => number
}

/**
 * Verifies a Standard Webhooks / Svix delivery. Returns `true` only when the
 * signature is authentic, recent, and well-formed; `false` otherwise. Callers
 * MUST throw on a `false` result so a forged/stale webhook is never acted on.
 */
export function verifyStandardWebhook(
  input: VerifyStandardWebhookInput
): boolean {
  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS
  if (tolerance < 0 || tolerance > MAX_TOLERANCE_SECONDS) return false
  if (typeof input.body !== "string") return false
  if (Buffer.byteLength(input.body) > MAX_BODY_BYTES) return false

  const id = input.headers[`${input.headerPrefix}-id`]
  const timestamp = input.headers[`${input.headerPrefix}-timestamp`]
  const signatureHeader = input.headers[`${input.headerPrefix}-signature`]
  // Required headers, fail-closed: an unsigned request is rejected outright.
  if (!id || !timestamp || !signatureHeader) return false
  // The timestamp is a string of ASCII digits (unix seconds).
  if (!/^\d+$/.test(timestamp)) return false

  const now = (input.now ?? defaultNow)()
  const ts = Number(timestamp)
  if (Math.abs(now - ts) > tolerance) return false

  if (!input.secret.startsWith(SECRET_PREFIX)) return false
  let secretBytes: Buffer
  try {
    secretBytes = Buffer.from(input.secret.slice(SECRET_PREFIX.length), "base64")
  } catch {
    return false
  }
  if (secretBytes.length === 0) return false

  const signedPayload = `${id}.${timestamp}.${input.body}`
  const computed = createHmac("sha256", secretBytes)
    .update(signedPayload)
    .digest("base64")

  // The signature header is a space-separated list of `v1,<base64>` entries.
  // Accept the delivery if any `v1` entry matches (supports key rotation).
  for (const entry of signatureHeader.split(" ")) {
    const comma = entry.indexOf(",")
    if (comma <= 0) continue
    const version = entry.slice(0, comma)
    const candidate = entry.slice(comma + 1)
    if (version !== "v1" || !candidate) continue
    if (safeEqualBase64(computed, candidate)) return true
  }
  return false
}

/** Signs a body for testing / dev self-signing (mirrors the sender's step 3). */
export function signStandardWebhook(opts: {
  body: string
  secret: string
  id: string
  timestamp: string
}): string {
  const secretBytes = Buffer.from(opts.secret.slice(SECRET_PREFIX.length), "base64")
  const signedPayload = `${opts.id}.${opts.timestamp}.${opts.body}`
  const sig = createHmac("sha256", secretBytes).update(signedPayload).digest("base64")
  return `v1,${sig}`
}

function defaultNow(): number {
  return Math.floor(Date.now() / 1000)
}

/** Constant-time comparison of two base64 signature strings. */
function safeEqualBase64(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}
