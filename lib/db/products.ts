import { prisma } from "./prisma"
import { getDefaultStoreId } from "./store"
import {
  DEFAULT_SEARCH_LIMIT,
  clampSearchLimit,
  getSearchTerm,
} from "@/features/search/search-logic"

export interface ProductInput {
  name: string
  slug: string
  description?: string | null
  price: string
  compareAtPrice?: string | null
  sku?: string | null
  categoryId: string
  imageUrl?: string | null
  stock?: number | null
  weightGrams?: number | null
  lengthCm?: number | null
  widthCm?: number | null
  heightCm?: number | null
}

export interface ProductUpdateInput {
  name: string
  slug: string
  description?: string | null
  price: string
  compareAtPrice?: string | null
  sku?: string | null
  categoryId: string
  imageUrl?: string | null
  stock?: number | null
  weightGrams?: number | null
  lengthCm?: number | null
  widthCm?: number | null
  heightCm?: number | null
}

/**
 * Lists all products for the default store, ordered by name.
 * Admin-facing: includes archived products and inventory so the dashboard can
 * show stock levels and soft-deleted items. Storefront queries use the
 * `*Storefront*` helpers which exclude archived products.
 */
export async function listProducts() {
  const storeId = await getDefaultStoreId()
  if (!storeId) return []

  return prisma.product.findMany({
    where: { storeId },
    orderBy: { name: "asc" },
    include: {
      category: { select: { id: true, name: true } },
      inventory: { select: { id: true, quantity: true, lowStockThreshold: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      federation: { select: { id: true, name: true, source: true } },
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
      inventory: { select: { id: true, quantity: true, lowStockThreshold: true } },
    },
  })
}

/**
 * Returns a single product by slug for the default store.
 * Used by the public storefront. Archived products are never surfaced to
 * shoppers — they are retained only for historical order integrity.
 */
export async function getProductBySlug(slug: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) return null

  return prisma.product.findFirst({
    where: { slug, storeId, archived: false },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" } },
      federation: { select: { id: true, name: true, source: true } },
    },
  })
}

/**
 * Lists all products for the default store, including the first image.
 * Used by the public storefront product listing page. Archived products are
 * excluded so shoppers never see soft-deleted catalog items.
 */
export async function listStorefrontProducts() {
  const storeId = await getDefaultStoreId()
  if (!storeId) return []

  return prisma.product.findMany({
    where: { storeId, archived: false },
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
    where: { storeId, archived: false },
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
 * Used by the public storefront category page. Archived products are excluded.
 */
export async function listProductsByCategory(categorySlug: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) return []

  return prisma.product.findMany({
    where: {
      storeId,
      archived: false,
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
 * Searches the storefront product catalog for the default store.
 *
 * Search contract (mirrors the pure reference implementation in
 * `features/search/search-logic.ts`):
 *   - case-insensitive substring (`contains`) matching,
 *   - across product `name`, `description`, `sku`, and category `name`,
 *   - archived products are NEVER returned,
 *   - results ordered by name ascending (stable, predictable),
 *   - result count clamped to `DEFAULT_SEARCH_LIMIT` to prevent excessive
 *     queries on a small catalog.
 *
 * Filtering is performed by PostgreSQL via Prisma — the entire catalog is
 * never loaded into the application. Returns an empty array when the query
 * is missing/blank/invalid (the caller should then browse all products
 * rather than treat this as a zero-result search).
 *
 * Future optimization (post-MVP): PostgreSQL full-text search (`tsvector` +
 * `tsquery` with `websearch_to_tsquery`), trigram indexes (`pg_trgm`) for
 * fuzzy/typo-tolerant matching, or pgvector semantic search. Not needed
 * for the current catalog size.
 */
export async function searchStorefrontProducts(
  rawQuery: string | null | undefined,
  limit: number | null | undefined = DEFAULT_SEARCH_LIMIT
) {
  const term = getSearchTerm(rawQuery)
  if (!term) return []

  const storeId = await getDefaultStoreId()
  if (!storeId) return []

  return prisma.product.findMany({
    where: {
      storeId,
      archived: false,
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { sku: { contains: term, mode: "insensitive" } },
        { category: { name: { contains: term, mode: "insensitive" } } },
      ],
    },
    orderBy: { name: "asc" },
    take: clampSearchLimit(limit),
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
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

  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, storeId },
    select: { id: true },
  })
  if (!category) {
    throw new Error("Category not found.")
  }

  const imageUrl = input.imageUrl?.trim() || null
  const stock = input.stock ?? null

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
      weightGrams: input.weightGrams ?? null,
      lengthCm: input.lengthCm ?? null,
      widthCm: input.widthCm ?? null,
      heightCm: input.heightCm ?? null,
      images: imageUrl
        ? { create: [{ url: imageUrl, sortOrder: 0 }] }
        : undefined,
      inventory: stock !== null ? { create: { quantity: stock } } : undefined,
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

  const product = await prisma.product.findFirst({
    where: { id, storeId },
    select: { id: true },
  })
  if (!product) {
    throw new Error("Product not found.")
  }

  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, storeId },
    select: { id: true },
  })
  if (!category) {
    throw new Error("Category not found.")
  }

  const imageUrl = input.imageUrl?.trim() || null
  const stock = input.stock ?? null

  // Replace existing images if a new URL is provided.
  if (imageUrl) {
    await prisma.productImage.deleteMany({ where: { productId: id } })
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
      weightGrams: input.weightGrams ?? null,
      lengthCm: input.lengthCm ?? null,
      widthCm: input.widthCm ?? null,
      heightCm: input.heightCm ?? null,
      images: imageUrl
        ? { create: [{ url: imageUrl, sortOrder: 0 }] }
        : undefined,
      inventory:
        stock !== null
          ? {
              upsert: {
                create: { quantity: stock },
                update: { quantity: stock },
              },
            }
          : undefined,
    },
  })
}

/**
 * Archives a product by id for the default store (soft delete).
 *
 * Products are referenced by `OrderItem` with `onDelete: Restrict`, so a hard
 * delete would fail (and corrupt history) once a product has been ordered.
 * Archiving sets `archived = true`: the product disappears from the storefront
 * and cart but is retained so historical order records stay intact. The admin
 * list still shows archived products so they can be inspected or restored.
 */
export async function deleteProduct(id: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store found.")
  }

  const product = await prisma.product.findFirst({
    where: { id, storeId },
    select: { id: true },
  })
  if (!product) {
    throw new Error("Product not found.")
  }

  return prisma.product.update({
    where: { id },
    data: { archived: true },
  })
}

/**
 * Restores an archived product (un-archives it) for the default store.
 */
export async function restoreProduct(id: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store found.")
  }

  const product = await prisma.product.findFirst({
    where: { id, storeId },
    select: { id: true },
  })
  if (!product) {
    throw new Error("Product not found.")
  }

  return prisma.product.update({
    where: { id },
    data: { archived: false },
  })
}