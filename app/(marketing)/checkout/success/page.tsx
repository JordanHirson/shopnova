import Link from "next/link"
import { notFound } from "next/navigation"
import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { getOrderByOrderNumber } from "@/lib/db"

export const dynamic = "force-dynamic"

interface CheckoutSuccessPageProps {
  searchParams: Promise<{ orderNumber?: string }>
}

export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  const { orderNumber } = await searchParams

  if (!orderNumber) {
    notFound()
  }

  const order = await getOrderByOrderNumber(orderNumber)

  if (!order) {
    notFound()
  }

  const isPaid = order.status === "CONFIRMED"

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-2xl rounded-lg border p-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isPaid ? "Payment Confirmed" : "Order Placed"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Your order{" "}
            <span className="font-semibold text-foreground">
              {order.orderNumber}
            </span>{" "}
            has been {isPaid ? "paid and confirmed." : "created."}
          </p>

          <div className="mt-6 rounded-lg bg-muted p-4 text-left text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium text-foreground">
                {order.status}
              </span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium text-foreground">
                ${Number(order.subtotal).toFixed(2)}
              </span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-medium text-foreground">
                {Number(order.shipping) === 0
                  ? "Free"
                  : `$${Number(order.shipping).toFixed(2)}`}
              </span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-muted-foreground">VAT (15%)</span>
              <span className="font-medium text-foreground">
                ${Number(order.tax).toFixed(2)}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t pt-2">
              <span className="font-semibold text-foreground">Total</span>
              <span className="font-semibold text-foreground">
                ${Number(order.total).toFixed(2)}
              </span>
            </div>
          </div>

          {isPaid ? (
            <div className="mt-6 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
              <p className="font-medium">Payment received</p>
              <p className="mt-1">
                Your payment was verified by our payment provider and your
                order is now confirmed. We will start preparing it for
                shipment.
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-medium">Payment not yet completed</p>
              <p className="mt-1">
                Your order has been created, but payment has not been
                confirmed yet. If you have already paid, please wait a
                moment and refresh — payment confirmations are processed
                asynchronously via the payment provider webhook.
              </p>
            </div>
          )}

          <div className="mt-6 flex justify-center gap-3">
            <Link href="/products" className={buttonVariants({ size: "lg" })}>
              Continue Shopping
            </Link>
          </div>
        </div>
      </Container>
    </div>
  )
}
