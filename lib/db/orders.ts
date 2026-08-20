/** ShopNova - Order database helpers.
 *
 * Order lookup for the confirmation page. Order CREATION now happens
 * only after a server-verified payment notification, atomically inside
 * `completePaidIntent` (see lib/db/payments.ts). That path preserves the
 * same inventory-safety guarantees: authoritative prices and inventory
 * are re-read from PostgreSQL inside a single transaction, and inventory
 * is decremented with a quantity guard so concurrent orders cannot
 * over-sell.
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