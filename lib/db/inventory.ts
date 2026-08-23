/**
 * ShopNova - Inventory database helpers.
 *
 * Admin-facing inventory queries and updates for the default store. These are
 * only reached after `requireAdmin()` has authorized the request server-side.
 *
 * Checkout safety: the transactional inventory decrement used during checkout
 * lives in `lib/db/payments.ts` `completePaidIntent` and uses a quantity-guarded
 * `updateMany` inside a transaction. These admin helpers do NOT participate in
 * that flow — they simply set absolute stock levels / thresholds. An admin
 * update and a concurrent checkout decrement operate on the same row but never
 * corrupt each other: the checkout guard re-reads inventory inside its
 * transaction, and admin updates use a straightforward `update`.
 */
import { prisma } from "./prisma"
import { getDefaultStoreId } from "./store"

export interface InventoryUpdateInput {
  quantity?: number
  lowStockThreshold?: number
}

/**
 * Lists all inventory rows for the default store with their product, ordered by
 * product name. Admin-facing.
 */
export async function listInventory() {
  const storeId = await getDefaultStoreId()
  if (!storeId) return []

  return prisma.inventory.findMany({
    orderBy: { product: { name: "asc" } },
    include: {
      product: {
        select: { id: true, name: true, slug: true, sku: true, archived: true },
      },
    },
  })
}

/**
 * Returns a single inventory row by product id for the default store.
 */
export async function getInventoryByProductId(productId: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) return null

  return prisma.inventory.findFirst({
    where: { productId, product: { storeId } },
    include: {
      product: { select: { id: true, name: true, storeId: true } },
    },
  })
}

/**
 * Updates an inventory row's quantity and/or low-stock threshold by product id.
 * Scoped to the default store so an admin can never touch another store's
 * inventory. Negative quantities are rejected by the caller's validation.
 */
export async function updateInventory(
  productId: string,
  input: InventoryUpdateInput
) {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store found.")
  }

  // Ensure the product belongs to the default store before updating.
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId },
    select: { id: true },
  })
  if (!product) {
    throw new Error("Product not found.")
  }

  const data: { quantity?: number; lowStockThreshold?: number } = {}
  if (input.quantity !== undefined) data.quantity = input.quantity
  if (input.lowStockThreshold !== undefined) {
    data.lowStockThreshold = input.lowStockThreshold
  }

  return prisma.inventory.update({
    where: { productId },
    data,
  })
}
