/** ShopNova - Order database helpers.
 *
 * Order lookup for the confirmation page. Order CREATION now happens
 * only after a server-verified payment notification, atomically inside
 * `completePaidIntent` (see lib/db/payments.ts). That path preserves the
 * same inventory-safety guarantees: authoritative prices and inventory
 * are re-read from PostgreSQL inside a single transaction, and inventory
 * is decremented with a quantity guard so concurrent orders cannot
 * over-sell.
 *
 * SECURITY: the customer-scoped helpers (`getOrdersForCustomer` and
 * `getOrderForCustomer`) are the authorization boundary for the account
 * area. They scope every query to the authenticated customer's id, so a
 * customer can never retrieve another customer's order by manipulating
 * an order number in the URL.
 */
import { prisma } from "./prisma"

/** Customer + shipping details collected at checkout. */
export interface CheckoutDetails {
  firstName: string
  lastName: string
  email: string
  phone: string
  shippingAddress: string
  city: string
  province: string
  postalCode: string
  country: string
}

/**
 * Returns an order by its customer-facing order number, including items.
 * Used by the order confirmation page.
 */
export async function getOrderByOrderNumber(orderNumber: string) {
  return prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  })
}

/**
 * Returns all orders for the given customer, newest first, with each
 * order's item count. Scoped to the customer id resolved from the
 * authenticated Clerk user — this is the authorization boundary for the
 * order-history page.
 */
export async function getOrdersForCustomer(customerId: string) {
  return prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { items: true } },
    },
  })
}

/**
 * Returns a single order by order number, ONLY when it belongs to the
 * given customer. Returns null when the order does not exist OR when it
 * belongs to a different customer — both cases are treated identically
 * so a customer cannot infer that an order number is valid for someone
 * else. This is the authorization boundary for the order-detail page.
 */
export async function getOrderForCustomer(
  customerId: string,
  orderNumber: string
) {
  return prisma.order.findFirst({
    where: { orderNumber, customerId },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, slug: true } },
        },
      },
      payments: {
        select: {
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
