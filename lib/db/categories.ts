import { prisma } from "./prisma"
import { requireStoreId, withStore } from "./utils"

export interface CategoryInput {
  name: string
  slug: string
  description?: string | null
}

export type CategoryUpdateInput = CategoryInput

function categoryData(input: CategoryInput) {
  return {
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
  }
}

/**
 * Lists all categories for the default store, ordered by name.
 */
export function listCategories() {
  return withStore(
    (storeId) =>
      prisma.category.findMany({
        where: { storeId },
        orderBy: { name: "asc" },
        include: {
          _count: { select: { products: true } },
        },
      }),
    []
  )
}

/**
 * Returns a single category by id for the default store.
 */
export function getCategoryById(id: string) {
  return withStore(
    (storeId) => prisma.category.findFirst({ where: { id, storeId } }),
    null
  )
}

/**
 * Returns a single category by slug for the default store.
 * Used by the public storefront category page.
 */
export function getCategoryBySlug(slug: string) {
  return withStore(
    (storeId) => prisma.category.findFirst({ where: { slug, storeId } }),
    null
  )
}

/**
 * Creates a new category for the default store.
 */
export async function createCategory(input: CategoryInput) {
  const storeId = await requireStoreId(
    "No store found. Create a store before adding categories."
  )

  return prisma.category.create({
    data: { ...categoryData(input), storeId },
  })
}

/**
 * Updates an existing category for the default store.
 */
export async function updateCategory(id: string, input: CategoryUpdateInput) {
  await requireStoreId()

  return prisma.category.update({
    where: { id },
    data: categoryData(input),
  })
}

/**
 * Deletes a category by id for the default store.
 */
export async function deleteCategory(id: string) {
  await requireStoreId()

  return prisma.category.delete({
    where: { id },
  })
}
