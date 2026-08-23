import Link from "next/link"
import { notFound } from "next/navigation"
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
import { getCustomerForAdmin } from "@/lib/db"
import { requireAdminOrRedirect } from "@/lib/auth/admin"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

interface CustomerDetailPageProps {
  params: Promise<{ customerId: string }>
}

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

function displayName(customer: {
  firstName: string | null
  lastName: string | null
  email: string
}) {
  const first = customer.firstName ?? ""
  const last = customer.lastName ?? ""
  const name = `${first} ${last}`.trim()
  return name || customer.email.split("@")[0]
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  // SECURITY: admin authorization happens server-side before any data load.
  await requireAdminOrRedirect()

  const { customerId } = await params
  if (!customerId) notFound()

  const customer = await getCustomerForAdmin(customerId)
  if (!customer) notFound()

  return (
    <Container>
      <Link
        href="/dashboard/customers"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-4 gap-1.5"
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to customers
      </Link>

      <div className="rounded-lg border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {displayName(customer)}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {customer.email}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Joined {formatDate(customer.createdAt)}
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground">
            {customer._count.orders} {customer._count.orders === 1 ? "order" : "orders"}
          </span>
        </div>

        {/* Contact summary (no auth identifiers like clerkUserId are exposed) */}
        <h2 className="mt-8 text-sm font-semibold text-foreground">Contact</h2>
        <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">First name</dt>
            <dd className="font-medium text-foreground">
              {customer.firstName ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last name</dt>
            <dd className="font-medium text-foreground">
              {customer.lastName ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="font-medium text-foreground">
              {customer.phone ?? "—"}
            </dd>
          </div>
        </dl>

        {/* Order history */}
        <h2 className="mt-8 text-sm font-semibold text-foreground">Orders</h2>
        <div className="mt-2 overflow-hidden rounded-lg border">
          {customer.orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No orders yet.
            </div>
          ) : (
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
                {customer.orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.orderNumber}
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
      </div>
    </Container>
  )
}
