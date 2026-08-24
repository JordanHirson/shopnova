import { notFound } from "next/navigation"
import { Container } from "@/components/layout/container"
import { getIntentById } from "@/lib/db"
import { TestPayView } from "@/components/storefront/test-pay-view"
import { getShopperId } from "@/features/cart/session"
import { isTestPaymentAllowed } from "@/features/payment/payment-logic"

export const dynamic = "force-dynamic"

interface TestPayPageProps {
  searchParams: Promise<{ intentId?: string }>
}

export default async function TestPayPage({ searchParams }: TestPayPageProps) {
  const { intentId } = await searchParams
  if (!intentId) notFound()

  const intent = await getIntentById(intentId)
  const shopperId = await getShopperId()
  if (
    !intent ||
    !isTestPaymentAllowed(
      process.env.NODE_ENV,
      intent.provider,
      intent.shopperId,
      shopperId
    )
  ) {
    notFound()
  }

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <TestPayView
          intentId={intent.id}
          orderNumber={intent.orderNumber}
          amount={Number(intent.amount)}
          status={intent.status}
        />
      </Container>
    </div>
  )
}
