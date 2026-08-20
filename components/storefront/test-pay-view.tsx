/**
 * ShopNova - Mock hosted payment page (Test gateway only).
 *
 * Replaces a real provider's hosted payment UI for local development and
 * automated verification. The "Pay" / "Decline" buttons call
 * `completeTestPaymentAction`, which constructs a verified notification
 * and runs it through the same `completePaidIntent` completion path as a
 * real webhook (idempotency, authoritative-amount guard, inventory
 * safety). No real card is charged.
 */
"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { completeTestPaymentAction } from "@/features/payment/actions"

interface TestPayViewProps {
  intentId: string
  orderNumber: string
  amount: number
  status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED"
}

export function TestPayView({
  intentId,
  orderNumber,
  amount,
  status,
}: TestPayViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function pay(success: boolean) {
    setError(null)
    startTransition(async () => {
      const { result } = await completeTestPaymentAction(intentId, success)
      if (result.status === "success" || result.status === "duplicate") {
        router.push(`/checkout/success?orderNumber=${orderNumber}`)
        return
      }
      if (result.status === "failed") {
        setError("Payment was declined. No order was created.")
        return
      }
      if (result.status === "not-found") {
        setError("Checkout intent not found.")
        return
      }
      if (result.status === "amount-mismatch") {
        setError("Payment amount did not match the server total.")
        return
      }
      setError("Unexpected payment result.")
    })
  }

  if (status === "COMPLETED") {
    return (
      <div className="mx-auto max-w-md rounded-lg border p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
        <h1 className="mt-4 text-xl font-bold text-foreground">Already paid</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Order {orderNumber} has already been paid.
        </p>
        <a
          href={`/checkout/success?orderNumber=${orderNumber}`}
          className={`mt-6 inline-block ${buttonVariants({ size: "lg" })}`}
        >
          View confirmation
        </a>
      </div>
    )
  }

  if (status === "FAILED" || status === "CANCELLED") {
    return (
      <div className="mx-auto max-w-md rounded-lg border p-8 text-center">
        <XCircle className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-4 text-xl font-bold text-foreground">
          Checkout expired
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This checkout can no longer be paid. Please start a new checkout.
        </p>
        <a
          href="/checkout"
          className={`mt-6 inline-block ${buttonVariants({ size: "lg" })}`}
        >
          Back to checkout
        </a>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md rounded-lg border p-8">
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        Mock Payment
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This is the local Test gateway. No real card is charged. The
        completion still runs through the verified-payment path used by
        Stripe and PayFast.
      </p>

      <div className="mt-6 rounded-lg bg-muted p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Order</span>
          <span className="font-medium text-foreground">{orderNumber}</span>
        </div>
        <div className="mt-2 flex justify-between border-t pt-2">
          <span className="font-semibold text-foreground">Total</span>
          <span className="font-semibold text-foreground">
            R {amount.toFixed(2)}
          </span>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm font-medium text-destructive">{error}</p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          className={buttonVariants({ size: "lg" })}
          disabled={isPending}
          onClick={() => pay(true)}
        >
          {isPending ? <Loader2 className="animate-spin" /> : null}
          {isPending ? "Processing..." : "Pay Now"}
        </button>
        <button
          type="button"
          className={buttonVariants({ variant: "outline", size: "lg" })}
          disabled={isPending}
          onClick={() => pay(false)}
        >
          Decline Payment
        </button>
      </div>
    </div>
  )
}
