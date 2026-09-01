/**
 * ShopNova - Stitch webhook endpoint.
 *
 * Stitch posts signed `payment` events here via Svix. The Svix signature in
 * the `svix-signature` header is verified server-side with
 * `STITCH_WEBHOOK_SECRET` (HMAC-SHA256 over `svix-id.svix-timestamp.body`,
 * the Standard Webhooks scheme) before anything is acted on. The browser
 * redirect is never trusted. Duplicate deliveries are idempotent.
 *
 * NOTE: the Stitch hosted-payment-session creation flow is now implemented
 * against the official `clientPaymentInitiationRequestCreate` GraphQL
 * mutation contract. `StitchProvider.isConfigured()` returns true when
 * `STITCH_CLIENT_ID`, `STITCH_CLIENT_SECRET`, and `STITCH_WEBHOOK_SECRET`
 * are all present, so this route processes real Stitch webhook deliveries
 * when the provider is configured. When the credentials are absent the route
 * responds `provider_not_configured`.
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
