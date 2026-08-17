/** ShopNova - Cart database helpers.
 *
 * The cart stores a display snapshot of product data, but the unit price
 * must always be captured read-only from PostgreSQL at add-to-cart time,
 * and stock availability must be checked against the Inventory model.
 *
 * PRICE RULE:
 * The client is NEVER authoritative for price. Checkout re-reads
 * authoritative prices from PostgreSQL before creating an order.
 */
import { prisma } from "./prisma"
import { getDefaultStoreId } from "./store"

/** Product data needed to build a cart line. */
export interface CartProductData {
  id: string
  name: string
  slug: string
  imageUrl: string | null
  price: number
  quantityAvailable: number
}

/**
 * Returns the product snapshot used to add an item to the cart,
 * including current price and available inventory for the default store.
 * Returns null when the product does not exist or has no inventory record.
 */
export async function getCartProduct(productId: string): Promise<CartProductData | null> {
  const storeId = await getDefaultStoreId()
  if (!storeId) return null

  const product = await prisma.product.findFirst({
    where: { id: productId, storeId },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      inventory: true,
    },
  })

  if (!product || !product.inventory) return null

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    imageUrl: product.images[0]?.url ?? null,
    price: Number(product.price),
    quantityAvailable: product.inventory.quantity,
  }
}