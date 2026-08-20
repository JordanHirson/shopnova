/**
 * ShopNova - Test gateway webhook endpoint.
 *
 * Accepts signed JSON callbacks from the local mock payment page so the
 * full webhook verification path (HMAC signature check via
 * TEST_PAYMENT_SECRET) runs end-to-end without real credentials. The
 * browser-supplied body is never trusted until the signature verifies.
 * Only registered outside production (see provider-registry).
 */
import { handleProviderWebhook, normalizeHeaders } from "@/features/payment/webhook-handler"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.text()
  const headers = normalizeHeaders(req.headers)
  const query = Object.fromEntries(new URL(req.url).searchParams.entries())

  const result = await handleProviderWebhook("test", body, headers, query)
  return Response.json(result.body, { status: result.status })
}
