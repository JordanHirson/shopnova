import { prisma } from "./prisma"
import { requireStoreId, withStore } from "./utils"

export interface ProductInput {
  name: string
  slug: string
  description?: string | null
  price: string
  compareAtPrice?: string | null
  sku?: string | null
  categoryId: string
}

export type ProductUpdateInput = ProductInput

/** Category fields needed by the dashboard product list. */
const dashboardInclude = {
  category: { select: { id: true, name: true } },
} as const

/** Category fields and the primary image needed by storefront listings. */
const storefrontInclude = {
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1 },
} as const

function productData(input: ProductInput) {
  return {
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    price: input.price,
    compareAtPrice: input.compareAtPrice ?? null,
    sku: input.sku ?? null,
    categoryId: input.categoryId,
  }
}

/**
 * Lists all products for the default store, ordered by name.
 */
export function listProducts() {
  return withStore(
    (storeId) =>
      prisma.product.findMany({
        where: { storeId },
        orderBy: { name: "asc" },
        include: dashboardInclude,
      }),
    []
  )
}

/**
 * Returns a single product by id for the default store.
 */
export function getProductById(id: string) {
  return withStore(
    (storeId) =>
      prisma.product.findFirst({
        where: { id, storeId },
        include: dashboardInclude,
      }),
    null
  )
}

/**
 * Returns a single product by slug for the default store.
 * Used by the public storefront.
 */
export function getProductBySlug(slug: string) {
  return withStore(
    (storeId) =>
      prisma.product.findFirst({
        where: { slug, storeId },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { sortOrder: "asc" } },
        },
      }),
    null
  )
}

/**
 * Lists all products for the default store, including the first image.
 * Used by the public storefront product listing page.
 */
export function listStorefrontProducts() {
  return withStore(
    (storeId) =>
      prisma.product.findMany({
        where: { storeId },
        orderBy: { name: "asc" },
        include: storefrontInclude,
      }),
    []
  )
}

/**
 * Lists a limited number of products for the storefront home page.
 */
export function listFeaturedProducts(limit = 8) {
  return withStore(
    (storeId) =>
      prisma.product.findMany({
        where: { storeId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: storefrontInclude,
      }),
    []
  )
}

/**
 * Lists products belonging to a category by category slug.
 * Used by the public storefront category page.
 */
export function listProductsByCategory(categorySlug: string) {
  return withStore(
    (storeId) =>
      prisma.product.findMany({
        where: {
          storeId,
          category: { slug: categorySlug },
        },
        orderBy: { name: "asc" },
        include: storefrontInclude,
      }),
    []
  )
}

/**
 * Creates a new product for the default store.
 */
export async function createProduct(input: ProductInput) {
  const storeId = await requireStoreId(
    "No store found. Create a store before adding products."
  )

  return prisma.product.create({
    data: { ...productData(input), storeId },
  })
}

/**
 * Updates an existing product for the default store.
 */
export async function updateProduct(id: string, input: ProductUpdateInput) {
  await requireStoreId()

  return prisma.product.update({
    where: { id },
    data: productData(input),
  })
}

/**
 * Deletes a product by id for the default store.
 */
export async function deleteProduct(id: string) {
  await requireStoreId()

  return prisma.product.delete({
    where: { id },
  })
}
