/**
 * ShopNova - Yoco webhook endpoint.
 *
 * Yoco posts signed `payment.succeeded` / `payment.failed` events here. The
 * Standard Webhooks signature in the `webhook-signature` header is verified
 * server-side with `YOCO_WEBHOOK_SECRET` (HMAC-SHA256 over
 * `webhook-id.webhook-timestamp.body`) before anything is acted on. The
 * browser redirect to `successUrl` is never trusted. Duplicate deliveries are
 * idempotent.
 */
import { handleProviderWebhook, normalizeHeaders } from "@/features/payment/webhook-handler"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.text()
  const headers = normalizeHeaders(req.headers)
  const query = Object.fromEntries(new URL(req.url).searchParams.entries())

  const result = await handleProviderWebhook("yoco", body, headers, query)
  return Response.json(result.body, { status: result.status })
}
