import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { Package } from "lucide-react"

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
import { getOrdersForCustomer } from "@/lib/db/orders"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

function formatCurrency(value: number, currency: string) {
  const symbol = currency === "ZAR" ? "R" : currency
  return `${symbol} ${value.toFixed(2)}`
}

function formatDate(value: Date) {
  return value.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default async function OrderHistoryPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in?redirect_url=/account/orders")

  const customer = await getCustomerForClerkUser(userId)
  const orders = customer ? await getOrdersForCustomer(customer.id) : []

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Order history
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                A list of every order placed from your account.
              </p>
            </div>
            <Link
              href="/account"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "gap-1.5"
              )}
            >
              Back to account
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="mt-4 font-medium text-foreground">No orders yet</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {customer
                  ? "You have not placed any orders yet. When you do, they will show up here."
                  : "Complete a signed-in checkout to link your account to your orders."}
              </p>
              <Link
                href="/products"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "mt-4 gap-1.5"
                )}
              >
                Start shopping
              </Link>
            </div>
          ) : (
            <div className="mt-8 overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium text-foreground">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell>{formatDate(order.createdAt)}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {order.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {order._count.items}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(order.total), order.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/account/orders/${order.orderNumber}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "xs" })
                          )}
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Container>
    </div>
  )
}
