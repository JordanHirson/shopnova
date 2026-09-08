/**
 * ShopNova - Cart abandonment recovery server action (Demo Step 7).
 *
 * "Trigger Recovery Email" builds the exact email that would be fired to the
 * customer (personalized subject, abandoned items, 10% discount recovery
 * link) and returns it for the live preview modal. In production this would
 * hand off to Resend/Customer.io; for the MVP demo it returns the rendered
 * preview so the merchant can see precisely what was sent.
 *
 * SECURITY: authorizes via `requireAdmin()` before any DB read — a customer
 * calling this action directly is rejected. The cart id is resolved
 * server-side from the store's real customers/products; no client input is
 * trusted for the email contents.
 */
"use server"

import {
  buildRecoveryEmail,
  type RecoveryEmailPreview,
} from "@/lib/db"
import {
  AdminRequiredError,
  UnauthenticatedError,
  requireAdmin,
} from "@/lib/auth/admin"

export interface RecoverySuccess {
  ok: true
  email: RecoveryEmailPreview
}

export interface RecoveryFailure {
  ok: false
  error: string
}

export type RecoveryResult = RecoverySuccess | RecoveryFailure

function errorMessage(err: unknown): string {
  if (err instanceof UnauthenticatedError) return err.message
  if (err instanceof AdminRequiredError) return err.message
  return err instanceof Error ? err.message : "Something went wrong."
}

/**
 * Triggers a recovery email for the given abandoned cart id and returns the
 * rendered email preview for the live preview modal.
 */
export async function triggerRecoveryEmailAction(
  cartId: string
): Promise<RecoveryResult> {
  try {
    await requireAdmin()
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }

  if (!cartId || typeof cartId !== "string") {
    return { ok: false, error: "Cart id is required." }
  }

  const email = await buildRecoveryEmail(cartId)
  if (!email) {
    return { ok: false, error: "Abandoned cart not found." }
  }

  // In production this would enqueue the email via Resend/Customer.io.
  // For the MVP demo we return the rendered preview so the merchant sees the
  // exact email dispatched.
  return { ok: true, email }
}
