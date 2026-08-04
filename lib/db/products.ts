import { prisma } from "./prisma"
import { getDefaultStoreId } from "./store"

export interface ProductInput {
  name: string
  slug: string
  description?: string | null
  price: string
  compareAtPrice?: string | null
  sku?: string | null
  categoryId: string
}

export interface ProductUpdateInput {
  name: string
  slug: string
  description?: string | null
  price: string
  compareAtPrice?: string | null
  sku?: string | null
  categoryId: string
}

/**
 * Lists all products for the default store, ordered by name.
 */
export async function listProducts() {
  const storeId = await getDefaultStoreId()
  if (!storeId) return []

  return prisma.product.findMany({
    where: { storeId },
    orderBy: { name: "asc" },
    include: {
      category: { select: { id: true, name: true } },
    },
  })
}

/**
 * Returns a single product by id for the default store.
 */
export async function getProductById(id: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) return null

  return prisma.product.findFirst({
    where: { id, storeId },
    include: {
      category: { select: { id: true, name: true } },
    },
  })
}

/**
 * Creates a new product for the default store.
 */
export async function createProduct(input: ProductInput) {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store found. Create a store before adding products.")
  }

  return prisma.product.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      sku: input.sku ?? null,
      categoryId: input.categoryId,
      storeId,
    },
  })
}

/**
 * Updates an existing product for the default store.
 */
export async function updateProduct(id: string, input: ProductUpdateInput) {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store found.")
  }

  return prisma.product.update({
    where: { id },
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      sku: input.sku ?? null,
      categoryId: input.categoryId,
    },
  })
}

/**
 * Deletes a product by id for the default store.
 */
export async function deleteProduct(id: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store found.")
  }

  return prisma.product.delete({
    where: { id },
  })
}