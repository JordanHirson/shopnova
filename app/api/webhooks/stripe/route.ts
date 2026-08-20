/**
 * ShopNova - Stripe webhook endpoint.
 *
 * Stripe posts signed `checkout.session.*` events here. The signature in
 * the `stripe-signature` header is verified server-side with
 * STRIPE_WEBHOOK_SECRET before anything is acted on. The browser is never
 * trusted. Duplicate deliveries are idempotent.
 */
import { handleProviderWebhook, normalizeHeaders } from "@/features/payment/webhook-handler"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.text()
  const headers = normalizeHeaders(req.headers)
  const query = Object.fromEntries(new URL(req.url).searchParams.entries())

  const result = await handleProviderWebhook("stripe", body, headers, query)
  return Response.json(result.body, { status: result.status })
}
