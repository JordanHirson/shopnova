import Link from "next/link"
import { Package } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { Container } from "@/components/layout/container"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { buttonVariants } from "@/components/ui/button"
import { listOrders } from "@/lib/db"
import { requireAdminOrRedirect } from "@/lib/auth/admin"
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

function customerName(order: {
  customer: { firstName: string | null; lastName: string | null; email: string } | null
}) {
  if (!order.customer) return "Guest"
  const first = order.customer.firstName ?? ""
  const last = order.customer.lastName ?? ""
  const name = `${first} ${last}`.trim()
  return name || order.customer.email
}

export default async function OrdersPage() {
  // SECURITY: admin authorization happens server-side before any data load.
  await requireAdminOrRedirect()

  const orders = await listOrders()

  return (
    <Container>
      <PageHeader
        title="Orders"
        description="View and manage customer orders."
      />
      <div className="mt-8 rounded-lg border">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="mt-4 font-medium text-foreground">No orders yet</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Orders will appear here once customers complete checkout.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
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
                  <TableCell className="font-medium">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customerName(order)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </TableCell>
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
                      href={`/dashboard/orders/${order.orderNumber}`}
                      className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Container>
  )
}
