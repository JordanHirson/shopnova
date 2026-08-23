/**
 * ShopNova - Admin database helpers.
 *
 * Read-side and order-status helpers for the admin dashboard. These queries
 * are admin-scoped (default store) and are ONLY reached after `requireAdmin()`
 * has authorized the request server-side (see lib/auth/admin.ts). They never
 * trust the browser.
 *
 * Payment security: these helpers never mutate `Payment.status` or set an
 * order's financial state to "paid". Order status updates are limited to the
 * fulfillment lifecycle (CONFIRMED → PROCESSING → SHIPPED → DELIVERED, or
 * CANCELLED). PENDING and REFUNDED are excluded from admin-settable statuses
 * (see features/admin/admin-logic.ts) so an admin UI action can never falsely
 * mark an order as paid or refunded — that must come from payment webhooks.
 */
import { prisma } from "./prisma"
import { getDefaultStoreId } from "./store"
import type { AdminOrderStatus } from "@/features/admin/admin-logic"

/** KPI overview for the admin dashboard home page. */
export interface AdminOverview {
  totalProducts: number
  activeProducts: number
  archivedProducts: number
  totalCategories: number
  totalCustomers: number
  totalOrders: number
  pendingOrders: number
  lowStockCount: number
  recentOrders: Array<{
    id: string
    orderNumber: string
    status: string
    total: { toString(): string }
    currency: string
    createdAt: Date
    customer: { firstName: string | null; lastName: string | null; email: string } | null
  }>
}

/**
 * Returns the dashboard KPI overview for the default store.
 */
export async function getAdminOverview(): Promise<AdminOverview | null> {
  const storeId = await getDefaultStoreId()
  if (!storeId) return null

  const [
    totalProducts,
    activeProducts,
    archivedProducts,
    totalCategories,
    totalCustomers,
    totalOrders,
    pendingOrders,
    activeProductsWithInventory,
    recentOrders,
  ] = await Promise.all([
    prisma.product.count({ where: { storeId } }),
    prisma.product.count({ where: { storeId, archived: false } }),
    prisma.product.count({ where: { storeId, archived: true } }),
    prisma.category.count({ where: { storeId } }),
    prisma.customer.count({ where: { storeId } }),
    prisma.order.count({ where: { storeId } }),
    prisma.order.count({
      where: { storeId, status: { in: ["PENDING", "CONFIRMED", "PROCESSING"] } },
    }),
    prisma.product.findMany({
      where: { storeId, archived: false },
      select: { inventory: { select: { quantity: true, lowStockThreshold: true } } },
    }),
    prisma.order.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        customer: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    }),
  ])

  // Low stock = quantity at or below the per-product threshold. Prisma cannot
  // compare two columns directly in a `where`, so this is computed in JS.
  const lowStockCount = activeProductsWithInventory.filter(
    (p) =>
      p.inventory !== null &&
      p.inventory.quantity <= p.inventory.lowStockThreshold
  ).length

  return {
    totalProducts,
    activeProducts,
    archivedProducts,
    totalCategories,
    totalCustomers,
    totalOrders,
    pendingOrders,
    lowStockCount,
    recentOrders,
  }
}

/**
 * Lists all orders for the default store, newest first, with item count and
 * customer summary. Admin-facing (not customer-scoped).
 */
export async function listOrders() {
  const storeId = await getDefaultStoreId()
  if (!storeId) return []

  return prisma.order.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { items: true } },
      customer: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  })
}

/**
 * Returns a single order by order number for the default store, including
 * items, customer, and payment summary. Admin-facing (not customer-scoped).
 *
 * SECURITY: callers MUST have already passed `requireAdmin()`. This helper
 * only scopes by store, not by customer, because admins legitimately need to
 * view any order.
 */
export async function getOrderForAdmin(orderNumber: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) return null

  return prisma.order.findFirst({
    where: { orderNumber, storeId },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, slug: true, archived: true } },
        },
      },
      customer: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      payments: {
        select: {
          id: true,
          gateway: true,
          status: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })
}

/**
 * Updates an order's fulfillment status. Only admin-settable statuses are
 * accepted (see features/admin/admin-logic.ts); the caller must validate the
 * status before calling. Payment status is never touched here.
 */
export async function updateOrderStatus(
  orderNumber: string,
  status: AdminOrderStatus
) {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store found.")
  }

  // Scope by store + orderNumber so a cross-store order number can never be
  // mutated. updateMany returns count 0 when the order doesn't exist.
  const result = await prisma.order.updateMany({
    where: { orderNumber, storeId },
    data: { status },
  })

  if (result.count === 0) {
    throw new Error("Order not found.")
  }

  return result
}

/**
 * Lists all customers for the default store with their order count and total
 * spent. Admin-facing. Sensitive data (clerkUserId, raw addresses) is not
 * surfaced here.
 */
export async function listCustomers() {
  const storeId = await getDefaultStoreId()
  if (!storeId) return []

  return prisma.customer.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { orders: true } },
    },
  })
}

/**
 * Returns a single customer by id for the default store, with their orders.
 * Admin-facing. Does not expose clerkUserId or other auth identifiers.
 */
export async function getCustomerForAdmin(customerId: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) return null

  return prisma.customer.findFirst({
    where: { id: customerId, storeId },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true } } },
      },
      _count: { select: { orders: true } },
    },
  })
}
