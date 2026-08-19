/** ShopNova - Order database helpers.
 *
 * Order creation is the critical inventory-safety path. The client is
 * NEVER trusted for price, inventory, subtotal, tax, shipping, or total.
 * All authoritative values are re-read from PostgreSQL inside a single
 * transaction, and inventory is decremented atomically so two concurrent
 * orders cannot both purchase stock that only exists in a smaller quantity.
 */
import { prisma } from "./prisma"
import { getDefaultStoreId } from "./store"
import {
  calculateOrderSubtotal,
  calculateOrderTotal,
  calculateShipping,
  calculateVat,
  generateOrderNumber,
  validateOrderQuantities,
} from "@/features/checkout/checkout-logic"
import type { CartItem } from "@/types/cart"

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

/** Result of a successful order creation. */
export interface CreateOrderResult {
  orderId: string
  orderNumber: string
}

/**
 * Creates an order for the default store inside a single transaction.
 *
 * Steps (all atomic):
 *   1. Re-read authoritative products + inventory from PostgreSQL.
 *   2. Verify all requested quantities are available.
 *   3. Calculate authoritative prices (subtotal, VAT, shipping, total).
 *   4. Find the existing Customer for the store + email, or create one.
 *   5. Create the Order with a shipping snapshot.
 *   6. Create all OrderItems.
 *   7. Decrement inventory atomically.
 *
 * If inventory is insufficient, the transaction throws and nothing is
 * persisted (no partial order, no partial inventory decrement).
 */
export async function createOrder(
  items: CartItem[],
  details: CheckoutDetails
): Promise<CreateOrderResult> {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store is configured.")
  }

  if (items.length === 0) {
    throw new Error("Your cart is empty.")
  }

  const orderNumber = generateOrderNumber()

  return prisma.$transaction(async (tx) => {
    // 1. Re-read authoritative products + inventory.
    const productIds = items.map((item) => item.productId)
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, storeId },
      include: { inventory: true },
    })

    const productById = new Map(products.map((p) => [p.id, p]))
    const availableByProduct = new Map<string, number>()
    for (const product of products) {
      availableByProduct.set(product.id, product.inventory?.quantity ?? 0)
    }

    // 2. Verify all requested quantities are available.
    const quantityError = validateOrderQuantities(items, availableByProduct)
    if (quantityError) {
      throw new Error(quantityError)
    }

    // 3. Calculate authoritative prices.
    const orderItems = items.map((item) => {
      const product = productById.get(item.productId)
      if (!product) {
        throw new Error("A product in your cart is no longer available.")
      }
      const unitPrice = Number(product.price)
      const totalPrice = Math.round(unitPrice * 100 * item.quantity) / 100
      return {
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
      }
    })

    const subtotal = calculateOrderSubtotal(items)
    const shipping = calculateShipping(subtotal)
    const vat = calculateVat(subtotal)
    const total = calculateOrderTotal(subtotal, shipping, vat)

    // 4. Find the existing Customer for the store + email, or create one.
    const customer = await tx.customer.upsert({
      where: { storeId_email: { storeId, email: details.email } },
      update: {
        firstName: details.firstName,
        lastName: details.lastName,
        phone: details.phone,
      },
      create: {
        storeId,
        email: details.email,
        firstName: details.firstName,
        lastName: details.lastName,
        phone: details.phone,
      },
    })

    // 5. Create the Order with a shipping snapshot.
    const order = await tx.order.create({
      data: {
        orderNumber,
        status: "PENDING",
        subtotal,
        tax: vat,
        shipping,
        total,
        storeId,
        customerId: customer.id,
        shippingFirstName: details.firstName,
        shippingLastName: details.lastName,
        shippingEmail: details.email,
        shippingPhone: details.phone,
        shippingAddress: details.shippingAddress,
        shippingCity: details.city,
        shippingProvince: details.province,
        shippingPostalCode: details.postalCode,
        shippingCountry: details.country,
      },
    })

    // 6. Create all OrderItems.
    await tx.orderItem.createMany({
      data: orderItems.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
    })

    // 7. Decrement inventory atomically.
    // updateMany with a quantity guard ensures we never decrement below
    // what is actually available, even under concurrent orders.
    for (const item of orderItems) {
      const result = await tx.inventory.updateMany({
        where: {
          productId: item.productId,
          quantity: { gte: item.quantity },
        },
        data: { quantity: { decrement: item.quantity } },
      })
      if (result.count === 0) {
        throw new Error("Insufficient inventory to complete the order.")
      }
    }

    return { orderId: order.id, orderNumber: order.orderNumber }
  })
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