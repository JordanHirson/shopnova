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
import {
  isAllowedOrderTransition,
  type AdminOrderStatus,
} from "../../features/admin/admin-logic.ts"
import type { Prisma } from "@prisma/client"

/**
 * Minimal Prisma client surface used by `updateOrderStatusTx`. Kept narrow so
 * the function can be unit-tested with a fake client instead of a database.
 */
export interface OrderInventoryClient {
  order: {
    findFirst(args: Prisma.OrderFindFirstArgs): Promise<unknown>
    update(args: Prisma.OrderUpdateArgs): Promise<unknown>
  }
  inventory: {
    update(args: Prisma.InventoryUpdateArgs): Promise<unknown>
  }
  $transaction: <T>(fn: (tx: OrderInventoryClient) => Promise<T>) => Promise<T>
}

/** Order loaded with its items and their product inventory, for cancellation. */
export interface LoadedOrder {
  orderNumber: string
  status: string
  items: Array<{
    quantity: number
    productId: string
    product: {
      id: string
      inventory: { quantity: number } | null
    } | null
  }>
}

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
          // Physical characteristics + inventory are included so the AI
          // operations triage (Demo Step 5) can verify stock and auto-calculate
          // weight & dimensions for courier booking without a second query.
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              archived: true,
              weightGrams: true,
              lengthCm: true,
              widthCm: true,
              heightCm: true,
              inventory: { select: { quantity: true } },
            },
          },
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
 * Updates an order's fulfillment status inside a database transaction.
 *
 * - Rejects any transition that is not allowed by `isAllowedOrderTransition`
 *   (so an order can only be cancelled once, and never leaves DELIVERED or
 *   CANCELLED).
 * - When the order moves to CANCELLED, each item's quantity is added back to
 *   its product's inventory in the SAME transaction as the status change, so
 *   stock is never lost and never returned twice.
 * - Payment status is never touched here.
 *
 * `tx` is injected so this can be unit-tested with a fake client.
 */
export async function updateOrderStatusTx(
  tx: OrderInventoryClient,
  storeId: string,
  orderNumber: string,
  status: AdminOrderStatus
) {
  // 1. Load the current order, scoped by store, with items + inventory.
  const current = (await tx.order.findFirst({
    where: { orderNumber, storeId },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, inventory: { select: { quantity: true } } },
          },
        },
      },
    },
  })) as LoadedOrder | null

  if (!current) {
    throw new Error("Order not found.")
  }

  // 2. Guard: only allowed transitions may proceed. CANCELLED → CANCELLED is
  //    blocked because CANCELLED is final, so stock can only be restocked once.
  if (!isAllowedOrderTransition(current.status as AdminOrderStatus, status)) {
    throw new Error(
      `Cannot transition order ${orderNumber} from "${current.status}" to "${status}".`
    )
  }

  // 3. Status change + restock atomically.
  return tx.$transaction(async (innerTx) => {
    const updated = await innerTx.order.update({
      where: { orderNumber, storeId },
      data: { status },
    })

    if (status === "CANCELLED") {
      // Return each purchased quantity to inventory, exactly once per item.
      for (const item of current.items) {
        const inventory = item.product?.inventory
        if (!inventory) continue
        await innerTx.inventory.update({
          where: { productId: item.productId },
          data: { quantity: { increment: item.quantity } },
        })
      }
    }

    return updated
  })
}

/**
 * Updates an order's fulfillment status. Only admin-settable statuses are
 * accepted (see features/admin/admin-logic.ts). Payment status is never
 * touched here.
 */
export async function updateOrderStatus(
  orderNumber: string,
  status: AdminOrderStatus
) {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store found.")
  }

  return updateOrderStatusTx(prisma, storeId, orderNumber, status)
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
