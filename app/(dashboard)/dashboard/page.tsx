import Link from "next/link"
import {
  Package,
  Tags,
  Users,
  ShoppingCart,
  Clock,
  AlertTriangle,
  Activity,
} from "lucide-react"

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
import { ActiveCartsFeed } from "@/components/dashboard/active-carts-feed"
import { getAdminOverview } from "@/lib/db/admin"
import { getAbandonedCarts } from "@/lib/db/abandonment"
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

export default async function DashboardPage() {
  // SECURITY: admin authorization happens server-side before any data load.
  await requireAdminOrRedirect()

  const overview = await getAdminOverview()
  const abandonedCarts = await getAbandonedCarts()

  if (!overview) {
    return (
      <Container>
        <PageHeader
          title="Dashboard"
          description="Overview of your store's performance."
        />
        <div className="mt-8 rounded-lg border p-12 text-center text-muted-foreground">
          <p>No store is configured yet. Seed the database to get started.</p>
        </div>
      </Container>
    )
  }

  const kpis = [
    {
      label: "Total Products",
      value: overview.totalProducts,
      hint: `${overview.activeProducts} active · ${overview.archivedProducts} archived`,
      icon: Package,
      href: "/dashboard/products",
    },
    {
      label: "Categories",
      value: overview.totalCategories,
      icon: Tags,
      href: "/dashboard/categories",
    },
    {
      label: "Customers",
      value: overview.totalCustomers,
      icon: Users,
      href: "/dashboard/customers",
    },
    {
      label: "Total Orders",
      value: overview.totalOrders,
      icon: ShoppingCart,
      href: "/dashboard/orders",
    },
    {
      label: "Pending Orders",
      value: overview.pendingOrders,
      hint: "Confirmed / processing",
      icon: Clock,
      href: "/dashboard/orders",
    },
    {
      label: "Low-stock Products",
      value: overview.lowStockCount,
      hint: "At or below threshold",
      icon: AlertTriangle,
      href: "/dashboard/inventory",
    },
  ]

  return (
    <Container>
      <PageHeader
        title="Dashboard"
        description="Overview of your store's performance."
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Link
              key={kpi.label}
              href={kpi.href}
              className="rounded-lg border p-6 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  {kpi.label}
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold">{kpi.value}</p>
              {kpi.hint ? (
                <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
              ) : null}
            </Link>
          )
        })}
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Recent orders
          </h2>
          <Link
            href="/dashboard/orders"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5"
            )}
          >
            View all
          </Link>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border">
          {overview.recentOrders.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <p>No orders yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.recentOrders.map((order) => (
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
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(order.total), order.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-lg font-semibold tracking-tight text-foreground">
            <Activity className="h-4 w-4 text-primary" />
            Active Carts &amp; Recovery
          </h2>
          <span className="text-xs text-muted-foreground">
            Real-time abandonment feed
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Carts left behind by shoppers, ranked by most recent activity.
          Trigger a recovery email with a 10% discount to win them back.
        </p>
        <div className="mt-4">
          <ActiveCartsFeed carts={abandonedCarts} />
        </div>
      </section>
    </Container>
  )
}
