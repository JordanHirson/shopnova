import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { ArrowLeft } from "lucide-react"

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
import { getCustomerForClerkUser } from "@/lib/db/customers"
import { getOrderForCustomer } from "@/lib/db/orders"
import { cn } from "@/lib/utils"

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
  const { userId } = await auth()
  if (!userId) redirect("/sign-in?redirect_url=/account/orders")

  const { orderNumber } = await params
  if (!orderNumber) notFound()

  const customer = await getCustomerForClerkUser(userId)
  // No customer record means the signed-in user has never completed a
  // signed-in checkout, so they cannot own any order.
  if (!customer) notFound()

  // SECURITY: the query is scoped to the authenticated customer's id.
  // A foreign order number resolves to null here, identical to a missing
  // one, so a customer can neither view nor confirm another customer's
  // order by manipulating the URL.
  const order = await getOrderForCustomer(customer.id, orderNumber)
  if (!order) notFound()

  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-3xl">
          <Link
            href="/account/orders"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "mb-4 gap-1.5"
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to orders
          </Link>

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
                      </TableCell>
                      <TableCell className="text-right">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(item.unitPrice), order.currency)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(
                          Number(item.totalPrice),
                          order.currency
                        )}
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
                <dd className="font-medium text-foreground">
                  {Number(order.shipping) === 0
                    ? "Free"
                    : formatCurrency(Number(order.shipping), order.currency)}
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

            {/* Shipping / contact info captured at checkout */}
            <h2 className="mt-8 text-sm font-semibold text-foreground">
              Shipping & contact
            </h2>
            <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Recipient</dt>
                <dd className="font-medium text-foreground">
                  {order.shippingFirstName} {order.shippingLastName}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium text-foreground">
                  {order.shippingEmail}
                </dd>
              </div>
              {order.shippingPhone ? (
                <div>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="font-medium text-foreground">
                    {order.shippingPhone}
                  </dd>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Shipping address</dt>
                <dd className="font-medium text-foreground">
                  {order.shippingAddress}
                  <br />
                  {order.shippingCity}, {order.shippingProvince}{" "}
                  {order.shippingPostalCode}
                  <br />
                  {order.shippingCountry}
                </dd>
              </div>
            </dl>

            {/* Payment summary */}
            {order.payments.length > 0 ? (
              <>
                <h2 className="mt-8 text-sm font-semibold text-foreground">
                  Payment
                </h2>
                <dl className="mt-2 space-y-2 text-sm">
                  {order.payments.map((payment) => (
                    <div
                      key={`${payment.gateway}-${payment.createdAt.toISOString()}`}
                      className="flex justify-between"
                    >
                      <dt className="text-muted-foreground capitalize">
                        {payment.gateway} · {payment.status}
                      </dt>
                      <dd className="font-medium text-foreground">
                        {formatCurrency(
                          Number(payment.amount),
                          payment.currency
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}
          </div>
        </div>
      </Container>
    </div>
  )
}
