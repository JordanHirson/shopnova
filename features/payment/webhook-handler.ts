/**
 * ShopNova - Shared webhook handler.
 *
 * Verifies a provider callback server-side, then runs the verified
 * notification through `completePaidIntent`. Returns the HTTP status the
 * route should respond with so the gateway retries appropriately.
 *
 * SECURITY:
 * - The provider verifies the signature/authenticity itself and throws
 *   when verification fails. We never trust the browser.
 * - Duplicate deliveries are idempotent (handled inside completePaidIntent).
 */
import "server-only"

import { completePaidIntent } from "@/lib/db"
import { getProvider } from "./provider-registry"
import type { PaymentProviderId } from "./types"

export interface WebhookHandlerResult {
  status: number
  body: { ok: boolean; result: string }
}

/**
 * Handles a verified provider webhook/ITN callback.
 *
 * Returns:
 * - 200 when the notification was processed (success, duplicate, or a
 *   cleanly-handled failure such as a failed payment or amount mismatch).
 * - 400 when signature verification fails or the provider is not
 *   configured (the gateway should NOT retry these).
 * - 404 when the referenced intent does not exist.
 * - 500 on unexpected errors (the gateway may retry).
 */
export async function handleProviderWebhook(
  providerId: PaymentProviderId,
  body: string,
  headers: Record<string, string>,
  query: Record<string, string>
): Promise<WebhookHandlerResult> {
  const provider = await getProvider(providerId)
  if (!provider) {
    return { status: 400, body: { ok: false, result: "provider_not_configured" } }
  }

  let notification
  try {
    notification = await provider.handleWebhook(body, headers, query)
  } catch (err) {
    // Signature failure / malformed payload — do not retry.
    return {
      status: 400,
      body: {
        ok: false,
        result: err instanceof Error ? err.message : "verification_failed",
      },
    }
  }

  // The provider returned null for an event type we do not act on (e.g. a
  // non-checkout Stripe event). Acknowledge so the gateway stops retrying.
  if (!notification) {
    return { status: 200, body: { ok: true, result: "ignored" } }
  }

  try {
    const result = await completePaidIntent(notification)
    switch (result.status) {
      case "success":
        return { status: 200, body: { ok: true, result: "success" } }
      case "duplicate":
        return { status: 200, body: { ok: true, result: "duplicate" } }
      case "failed":
        return { status: 200, body: { ok: true, result: "failed" } }
      case "amount-mismatch":
        // Amount mismatch is a potential fraud signal — do not retry.
        return { status: 400, body: { ok: false, result: "amount_mismatch" } }
      case "not-found":
        return { status: 404, body: { ok: false, result: "not_found" } }
    }
  } catch (err) {
    return {
      status: 500,
      body: {
        ok: false,
        result: err instanceof Error ? err.message : "internal_error",
      },
    }
  }
}

/** Lowercases + trims request headers for case-insensitive provider lookup. */
export function normalizeHeaders(
  incoming: Headers
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of incoming.entries()) {
    out[key.toLowerCase()] = value
  }
  return out
}
