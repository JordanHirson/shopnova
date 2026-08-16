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
 * Returns a single product by slug for the default store.
 * Used by the public storefront.
 */
export async function getProductBySlug(slug: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) return null

  return prisma.product.findFirst({
    where: { slug, storeId },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" } },
    },
  })
}

/**
 * Lists all products for the default store, including the first image.
 * Used by the public storefront product listing page.
 */
export async function listStorefrontProducts() {
  const storeId = await getDefaultStoreId()
  if (!storeId) return []

  return prisma.product.findMany({
    where: { storeId },
    orderBy: { name: "asc" },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
  })
}

/**
 * Lists a limited number of products for the storefront home page.
 */
export async function listFeaturedProducts(limit = 8) {
  const storeId = await getDefaultStoreId()
  if (!storeId) return []

  return prisma.product.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
  })
}

/**
 * Lists products belonging to a category by category slug.
 * Used by the public storefront category page.
 */
export async function listProductsByCategory(categorySlug: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) return []

  return prisma.product.findMany({
    where: {
      storeId,
      category: { slug: categorySlug },
    },
    orderBy: { name: "asc" },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
  })
}

/**
 * Throws unless the category belongs to the given store.
 */
async function assertCategoryInStore(categoryId: string, storeId: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, storeId },
    select: { id: true },
  })

  if (!category) {
    throw new Error("Category not found.")
  }
}

/**
 * Creates a new product for the default store.
 */
export async function createProduct(input: ProductInput) {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store found. Create a store before adding products.")
  }

  await assertCategoryInStore(input.categoryId, storeId)

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

  await assertCategoryInStore(input.categoryId, storeId)

  const { count } = await prisma.product.updateMany({
    where: { id, storeId },
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

  if (count === 0) {
    throw new Error("Product not found.")
  }
}

/**
 * Deletes a product by id for the default store.
 */
export async function deleteProduct(id: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store found.")
  }

  const { count } = await prisma.product.deleteMany({
    where: { id, storeId },
  })

  if (count === 0) {
    throw new Error("Product not found.")
  }
}