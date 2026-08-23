import { prisma } from "./prisma"
import { getDefaultStoreId } from "./store"

export interface CategoryInput {
  name: string
  slug: string
  description?: string | null
}

export interface CategoryUpdateInput {
  name: string
  slug: string
  description?: string | null
}

/**
 * Lists all categories for the default store, ordered by name.
 */
export async function listCategories() {
  const storeId = await getDefaultStoreId()
  if (!storeId) return []

  return prisma.category.findMany({
    where: { storeId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: true } },
    },
  })
}

/**
 * Returns a single category by id for the default store.
 */
export async function getCategoryById(id: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) return null

  return prisma.category.findFirst({
    where: { id, storeId },
  })
}

/**
 * Returns a single category by slug for the default store.
 * Used by the public storefront category page.
 */
export async function getCategoryBySlug(slug: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) return null

  return prisma.category.findFirst({
    where: { slug, storeId },
  })
}

/**
 * Creates a new category for the default store.
 */
export async function createCategory(input: CategoryInput) {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store found. Create a store before adding categories.")
  }

  return prisma.category.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      storeId,
    },
  })
}

/**
 * Updates an existing category for the default store.
 */
export async function updateCategory(id: string, input: CategoryUpdateInput) {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store found.")
  }

  return prisma.category.update({
    where: { id },
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
    },
  })
}

/**
 * Deletes a category by id for the default store.
 *
 * Products reference their category with `onDelete: Restrict`, so deleting a
 * category that still has products would either fail at the database layer or
 * silently orphan those products. This helper pre-checks the product count and
 * throws a clear, actionable error before attempting the delete, so the admin
 * is told to move/reassign products first rather than seeing a raw FK error.
 */
export async function deleteCategory(id: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store found.")
  }

  const productCount = await prisma.product.count({
    where: { categoryId: id },
  })

  if (productCount > 0) {
    throw new Error(
      `Cannot delete a category that still has ${productCount} product(s). ` +
        "Reassign or archive those products first."
    )
  }

  return prisma.category.delete({
    where: { id },
  })
}