/**
 * ShopNova - Payment database helpers.
 *
 * Checkout intent persistence and verified payment completion.
 *
 * SECURITY:
 * - An order is only created (and only marked paid) after a server-verified
 *   provider notification (webhook / ITN) passes signature verification.
 *   Browser-supplied success is never trusted.
 * - Amounts are authoritative: recomputed from PostgreSQL values at intent
 *   creation, then re-checked against the gateway's verified notification.
 * - Idempotency: `completedPayloadKey` (unique) + guarded status transition
 *   makes webhooks idempotent and ensures they can never double-create an
 *   order or double-decrement inventory.
 */
import { prisma } from "./prisma"
import { getDefaultStoreId } from "./store"
import type { CheckoutDetails } from "./orders"
import {
  calculateOrderTotal,
  calculateShipping,
  calculateVat,
  generateOrderNumber,
  validateOrderQuantities,
} from "@/features/checkout/checkout-logic"
import type { PaymentNotification, PaymentProviderId } from "@/features/payment/types"
import { cartStore } from "@/features/cart/cart-store"

/** A single product line stored on an intent (authoritative quantity snapshot). */
export interface IntentLine {
  productId: string
  quantity: number
}

/** Input for creating a pending checkout intent. */
export interface CreateIntentInput {
  shopperId: string
  provider: PaymentProviderId
  details: CheckoutDetails
  items: IntentLine[]
}

/** A created intent ready to be redirected to the hosted payment UI. */
export interface CreatedIntent {
  intentId: string
  orderNumber: string
}

/** Result of processing a verified provider notification. */
export type PaymentCompletionResult =
  | { status: "success"; orderNumber: string }
  | { status: "duplicate"; orderNumber?: string }
  | { status: "not-found" }
  | { status: "amount-mismatch" }
  | { status: "failed" }

/**
 * Creates a PENDING CheckoutIntent.
 *
 * The authoritative amount is computed entirely server-side from the
 * database (product prices re-read inside the intent creation) so a
 * tampered client total can never be charged.
 */
export async function createCheckoutIntent(
  input: CreateIntentInput
): Promise<CreatedIntent> {
  const storeId = await getDefaultStoreId()
  if (!storeId) throw new Error("No store is configured.")
  if (input.items.length === 0) throw new Error("Your cart is empty.")

  const orderNumber = generateOrderNumber()

  // Re-read authoritative product prices/inventory and compute the amount.
  const productIds = input.items.map((i) => i.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, storeId },
    include: { inventory: true },
  })

  const productById = new Map(products.map((p) => [p.id, p]))
  const availableByProduct = new Map<string, number>()
  for (const product of products) {
    availableByProduct.set(product.id, product.inventory?.quantity ?? 0)
  }

  const quantityError = validateOrderQuantities(input.items, availableByProduct)
  if (quantityError) throw new Error(quantityError)

  let subtotal = 0
  for (const line of input.items) {
    const product = productById.get(line.productId)
    if (!product) throw new Error("A product in your cart is no longer available.")
    subtotal += Math.round(Number(product.price) * 100 * line.quantity) / 100
  }

  const shipping = calculateShipping(subtotal)
  const vat = calculateVat(subtotal)
  const total = calculateOrderTotal(subtotal, shipping, vat)

  const intent = await prisma.checkoutIntent.create({
    data: {
      orderNumber,
      storeId,
      provider: input.provider,
      shopperId: input.shopperId,
      amount: total,
      currency: "ZAR",
      details: input.details as unknown as object,
      items: input.items as unknown as object,
    },
  })

  return { intentId: intent.id, orderNumber: intent.orderNumber }
}

/**
 * Marks an intent with its provider reference after the hosted session
 * has been created successfully.
 */
export async function attachProviderReference(
  intentId: string,
  providerReference: string
): Promise<void> {
  await prisma.checkoutIntent.update({
    where: { id: intentId },
    data: { providerReference },
  })
}

/**
 * Returns a pending intent by id (used by the checkout/payment UI).
 */
export async function getIntentById(intentId: string) {
  return prisma.checkoutIntent.findUnique({ where: { id: intentId } })
}

/**
 * Completes a checkout intent after a VERIFIED provider notification.
 *
 * This is the only place an Order is created, and it happens atomically
 * with: intent transition to COMPLETED, order + order items creation,
 * price snapshots, inventory decrement, and a SUCCEEDED Payment record.
 * The unique `completedPayloadKey` + `status: PENDING` guarded transition
 * makes duplicate webhook deliveries idempotent.
 */
export async function completePaidIntent(
  notification: PaymentNotification
): Promise<PaymentCompletionResult> {
  // Find the intent the gateway round-tripped in its metadata/reference.
  const intent = notification.intentId
    ? await prisma.checkoutIntent.findUnique({
        where: { id: notification.intentId },
      })
    : await prisma.checkoutIntent.findFirst({
        where: { providerReference: notification.providerReference },
      })

  if (!intent) return { status: "not-found" }

  // Already completed by the same payload => safe duplicate to the gateway.
  if (intent.completedPayloadKey === notification.payloadKey) {
    const existing = await prisma.order.findFirst({
      where: { orderNumber: intent.orderNumber },
    })
    return { status: "duplicate", orderNumber: existing?.orderNumber }
  }

  // Already completed by a DIFFERENT payload => conflicting duplicate.
  if (intent.status === "COMPLETED" || intent.completedPayloadKey) {
    return { status: "duplicate" }
  }

  // Failed/cancelled gateway notification: mark the intent failed.
  if (!notification.success) {
    await prisma.checkoutIntent.update({
      where: { id: intent.id },
      data: { status: "FAILED", errorCode: notification.errorCode ?? "payment_failed" },
    })
    return { status: "failed" }
  }

  // Authoritative amount guard: the gateway's verified charge must EXACTLY
  // match the server-computed intent amount (cents).
  const serverAmountCents = Math.round(Number(intent.amount) * 100)
  if (serverAmountCents !== notification.amountMinor) {
    return { status: "amount-mismatch" }
  }

  const items = intent.items as unknown as IntentLine[]
  const details = intent.details as unknown as CheckoutDetails

  return prisma.$transaction(async (tx) => {
    // Atomic idempotency guard: only one callback may transition the intent.
    const claimed = await tx.checkoutIntent.updateMany({
      where: {
        id: intent.id,
        status: "PENDING",
        completedPayloadKey: null,
      },
      data: {
        status: "COMPLETED",
        completedPayloadKey: notification.payloadKey,
      },
    })
    if (claimed.count === 0) {
      const existing = await tx.order.findFirst({
        where: { orderNumber: intent.orderNumber },
      })
      return { status: "duplicate", orderNumber: existing?.orderNumber } satisfies PaymentCompletionResult
    }

    // 1. Re-read authoritative products + inventory.
    const productIds = items.map((i) => i.productId)
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, storeId: intent.storeId },
      include: { inventory: true },
    })
    const productById = new Map(products.map((p) => [p.id, p]))

    // 2. Verify quantities against stock (again — inventory may have moved
    //    since the intent was created).
    const availableByProduct = new Map<string, number>()
    for (const product of products) {
      availableByProduct.set(product.id, product.inventory?.quantity ?? 0)
    }
    const quantityError = validateOrderQuantities(items, availableByProduct)
    if (quantityError) {
      await tx.checkoutIntent.update({
        where: { id: intent.id },
        data: {
          status: "FAILED",
          errorCode: "insufficient_inventory",
        },
      })
      throw new Error(quantityError)
    }

    // 3. Calculate authoritative prices.
    const orderItems = items.map((item) => {
      const product = productById.get(item.productId)
      if (!product) {
        throw new Error("A product in your order is no longer available.")
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

    // Subtotal is computed directly from the authoritative DB price snapshots.
    const computedSubtotal = orderItems.reduce((sum, i) => sum + i.totalPrice, 0)
    const shipping = calculateShipping(computedSubtotal)
    const vat = calculateVat(computedSubtotal)
    const total = calculateOrderTotal(computedSubtotal, shipping, vat)

    // 4. Find or create the Customer (preserves @@unique([storeId, email])).
    const customer = await tx.customer.upsert({
      where: { storeId_email: { storeId: intent.storeId, email: details.email } },
      update: {
        firstName: details.firstName,
        lastName: details.lastName,
        phone: details.phone,
      },
      create: {
        storeId: intent.storeId,
        email: details.email,
        firstName: details.firstName,
        lastName: details.lastName,
        phone: details.phone,
      },
    })

    // 5. Create the Order as CONFIRMED (paid via verified gateway notification).
    const order = await tx.order.create({
      data: {
        orderNumber: intent.orderNumber,
        status: "CONFIRMED",
        subtotal: computedSubtotal,
        tax: vat,
        shipping,
        total,
        currency: intent.currency || "ZAR",
        storeId: intent.storeId,
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

    // 6. Create all OrderItems with DB price snapshots.
    await tx.orderItem.createMany({
      data: orderItems.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
    })

    // 7. Decrement inventory atomically (never below what is available).
    for (const item of orderItems) {
      const result = await tx.inventory.updateMany({
        where: {
          productId: item.productId,
          quantity: { gte: item.quantity },
        },
        data: { quantity: { decrement: item.quantity } },
      })
      if (result.count === 0) {
        await tx.checkoutIntent.update({
          where: { id: intent.id },
          data: { status: "FAILED", errorCode: "insufficient_inventory" },
        })
        throw new Error("Insufficient inventory to complete the order.")
      }
    }

    // 8. Record the verified Payment (idempotence key = gateway event id).
    await tx.payment.create({
      data: {
        orderId: order.id,
        intentId: intent.id,
        gateway: intent.provider,
        amount: total,
        currency: intent.currency || "ZAR",
        status: "SUCCEEDED",
        providerReference: notification.providerReference,
        eventId: notification.payloadKey,
      },
    })

    return { status: "success", orderNumber: order.orderNumber } satisfies PaymentCompletionResult
  }).then(async (result) => {
    // The cart is cleared only when the verified payment created the order.
    if (result.status === "success") {
      await cartStore.deleteCart(intent.shopperId)
    }
    return result
  }).catch((err) => {
    if (err instanceof Error && err.message.includes("Insufficient inventory")) {
      return { status: "failed" } satisfies PaymentCompletionResult
    }
    throw err
  })
}