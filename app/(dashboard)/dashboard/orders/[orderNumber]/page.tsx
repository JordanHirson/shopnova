import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Lock } from "lucide-react"

import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getOrderForAdmin } from "@/lib/db"
import { requireAdminOrRedirect } from "@/lib/auth/admin"
import { triageOrder, type TriageOrder } from "@/features/admin/ai-triage"
import { cn } from "@/lib/utils"
import { AiOperationsCopilot } from "../ai-operations-copilot"
import { OrderStatusForm } from "../order-status-form"

export const dynamic = "force-dynamic"

interface OrderDetailPageProps {
  params: Promise<{ orderNumber: string }>
}

function formatCurrency(value: number, currency: string) {
  const symbol = currency === "ZAR" ? "R" : currency
  return `${symbol} ${value.toFixed(2)}`
}

function formatDate(value: Date) {
  return value.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  // SECURITY: admin authorization happens server-side before any data load.
  await requireAdminOrRedirect()

  const { orderNumber } = await params
  if (!orderNumber) notFound()

  const order = await getOrderForAdmin(orderNumber)
  if (!order) notFound()

  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0)
  const paidStatuses = order.payments.map((p) => p.status)
  const isPaid = paidStatuses.includes("SUCCEEDED")

  // AI Operations Copilot (Demo Step 5): triage runs server-side on every
  // page load so the analysis is always current. The fulfilment action is
  // triggered client-side from the copilot card.
  const triageInput: TriageOrder = {
    orderNumber: order.orderNumber,
    currency: order.currency,
    subtotal: Number(order.subtotal),
    shippingCity: order.shippingCity,
    shippingProvince: order.shippingProvince,
    shippingPostalCode: order.shippingPostalCode,
    shippingCountry: order.shippingCountry,
    shippingAddress: order.shippingAddress,
    isPaid,
    items: order.items.map((item) => ({
      quantity: item.quantity,
      product: {
        weightGrams: item.product.weightGrams,
        lengthCm: item.product.lengthCm,
        widthCm: item.product.widthCm,
        heightCm: item.product.heightCm,
        inventory: item.product.inventory,
      },
    })),
  }
  const triage = await triageOrder(triageInput)

  return (
    <Container>
      <Link
        href="/dashboard/orders"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-4 gap-1.5"
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to orders
      </Link>

      <AiOperationsCopilot
        orderNumber={order.orderNumber}
        triage={triage}
        className="mb-6"
      />

      <div className="rounded-lg border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {order.orderNumber}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Placed {formatDate(order.createdAt)}
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground">
            {order.status}
          </span>
        </div>

        {/* Items */}
        <h2 className="mt-8 text-sm font-semibold text-foreground">
          Items ({itemCount})
        </h2>
        <div className="mt-2 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      href={`/products/${item.product.slug}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {item.product.name}
                    </Link>
                    {item.product.archived ? (
                      <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Archived
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(item.unitPrice), order.currency)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(item.totalPrice), order.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Totals */}
        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="font-medium text-foreground">
              {formatCurrency(Number(order.subtotal), order.currency)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd className="text-right font-medium text-foreground">
              {Number(order.shipping) === 0
                ? "Free"
                : formatCurrency(Number(order.shipping), order.currency)}
              {order.shippingMethod ? (
                <span className="block text-xs font-normal text-muted-foreground">
                  {order.shippingMethod}
                </span>
              ) : null}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">VAT (15%)</dt>
            <dd className="font-medium text-foreground">
              {formatCurrency(Number(order.tax), order.currency)}
            </dd>
          </div>
          <div className="flex justify-between border-t pt-2">
            <dt className="font-semibold text-foreground">Total</dt>
            <dd className="font-semibold text-foreground">
              {formatCurrency(Number(order.total), order.currency)}
            </dd>
          </div>
        </dl>

        {/* Customer + shipping */}
        <h2 className="mt-8 text-sm font-semibold text-foreground">Customer</h2>
        <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium text-foreground">
              {order.customer
                ? `${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim() || "—"
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium text-foreground">
              {order.customer?.email ?? order.shippingEmail}
            </dd>
          </div>
          {order.customer?.phone || order.shippingPhone ? (
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium text-foreground">
                {order.customer?.phone ?? order.shippingPhone}
              </dd>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Shipping address</dt>
            <dd className="font-medium text-foreground">
              {order.shippingFirstName} {order.shippingLastName}
              <br />
              {order.shippingAddress}
              <br />
              {order.shippingCity}, {order.shippingProvince} {order.shippingPostalCode}
              <br />
              {order.shippingCountry}
            </dd>
          </div>
        </dl>

        {/* Payment summary (read-only — payment status comes from webhooks) */}
        <h2 className="mt-8 text-sm font-semibold text-foreground">Payment</h2>
        {order.payments.length > 0 ? (
          <dl className="mt-2 space-y-2 text-sm">
            {order.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex justify-between rounded-md border p-3"
              >
                <dt className="text-muted-foreground">
                  <span className="capitalize">{payment.gateway}</span> · {payment.status}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatDate(payment.createdAt)}
                  </span>
                </dt>
                <dd className="font-medium text-foreground">
                  {formatCurrency(Number(payment.amount), payment.currency)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No payment records.</p>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Payment status is set by verified gateway webhooks and cannot be changed here.
        </p>

        {/* Fulfillment status update (admin-settable statuses only) */}
        <h2 className="mt-8 text-sm font-semibold text-foreground">
          Fulfillment status
        </h2>
        <div className="mt-2">
          <OrderStatusForm
            orderNumber={order.orderNumber}
            currentStatus={order.status}
          />
        </div>
        {isPaid ? (
          <p className="mt-2 text-xs text-muted-foreground">
            This order has a succeeded payment. Updating fulfillment status does
            not change payment state.
          </p>
        ) : null}
      </div>
    </Container>
  )
}
