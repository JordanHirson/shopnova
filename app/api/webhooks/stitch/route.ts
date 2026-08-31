/**
 * ShopNova - Stitch webhook endpoint.
 *
 * Stitch posts signed `payment` events here via Svix. The Svix signature in
 * the `svix-signature` header is verified server-side with
 * `STITCH_WEBHOOK_SECRET` (HMAC-SHA256 over `svix-id.svix-timestamp.body`,
 * the Standard Webhooks scheme) before anything is acted on. The browser
 * redirect is never trusted. Duplicate deliveries are idempotent.
 *
 * NOTE: the Stitch hosted-payment-session creation flow is pending the
 * official `clientPaymentInitiationRequestCreate` GraphQL mutation contract,
 * so `StitchProvider.isConfigured()` currently returns false and this route
 * responds `provider_not_configured` until that contract is wired up. The
 * route + Svix verification are in place and tested so the integration is a
 * one-line flip once the creation flow is implemented.
 */
import { handleProviderWebhook, normalizeHeaders } from "@/features/payment/webhook-handler"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.text()
  const headers = normalizeHeaders(req.headers)
  const query = Object.fromEntries(new URL(req.url).searchParams.entries())

  const result = await handleProviderWebhook("stitch", body, headers, query)
  return Response.json(result.body, { status: result.status })
}
