/**
 * ShopNova - PayFast ITN (Instant Transaction Notification) endpoint.
 *
 * PayFast posts the ITN callback server-to-server with form-encoded
 * fields and an MD5 signature. The signature is verified server-side
 * with the merchant passphrase before anything is acted on. The browser
 * is never trusted. Duplicate ITN deliveries are idempotent.
 */
import { handleProviderWebhook, normalizeHeaders } from "@/features/payment/webhook-handler"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.text()
  const headers = normalizeHeaders(req.headers)
  const query = Object.fromEntries(new URL(req.url).searchParams.entries())

  const result = await handleProviderWebhook("payfast", body, headers, query)
  return Response.json(result.body, { status: result.status })
}
