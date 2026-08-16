import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma, mockDefaultStore } from "@/tests/helpers/prisma-mock"
import {
  createCategory,
  deleteCategory,
  getCategoryById,
  getCategoryBySlug,
  listCategories,
  updateCategory,
} from "@/lib/db/categories"

vi.mock("@/lib/db/prisma", () => import("@/tests/helpers/prisma-mock"))

const input = {
  name: "Electronics",
  slug: "electronics",
  description: "Gadgets",
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDefaultStore({ id: "store_1" })
})

describe("listCategories", () => {
  it("lists the default store categories with product counts", async () => {
    const categories = [{ id: "cat_1" }]
    prisma.category.findMany.mockResolvedValue(categories)

    await expect(listCategories()).resolves.toBe(categories)
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { storeId: "store_1" },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    })
  })

  it("returns an empty list when no store exists", async () => {
    mockDefaultStore(null)

    await expect(listCategories()).resolves.toEqual([])
    expect(prisma.category.findMany).not.toHaveBeenCalled()
  })
})

describe("getCategoryById", () => {
  it("scopes the lookup to the default store", async () => {
    const category = { id: "cat_1" }
    prisma.category.findFirst.mockResolvedValue(category)

    await expect(getCategoryById("cat_1")).resolves.toBe(category)
    expect(prisma.category.findFirst).toHaveBeenCalledWith({
      where: { id: "cat_1", storeId: "store_1" },
    })
  })

  it("returns null when no store exists", async () => {
    mockDefaultStore(null)

    await expect(getCategoryById("cat_1")).resolves.toBeNull()
    expect(prisma.category.findFirst).not.toHaveBeenCalled()
  })
})

describe("getCategoryBySlug", () => {
  it("scopes the lookup to the default store", async () => {
    const category = { id: "cat_1" }
    prisma.category.findFirst.mockResolvedValue(category)

    await expect(getCategoryBySlug("electronics")).resolves.toBe(category)
    expect(prisma.category.findFirst).toHaveBeenCalledWith({
      where: { slug: "electronics", storeId: "store_1" },
    })
  })

  it("returns null when no store exists", async () => {
    mockDefaultStore(null)

    await expect(getCategoryBySlug("electronics")).resolves.toBeNull()
    expect(prisma.category.findFirst).not.toHaveBeenCalled()
  })
})

describe("createCategory", () => {
  it("creates the category against the default store", async () => {
    const created = { id: "cat_1" }
    prisma.category.create.mockResolvedValue(created)

    await expect(createCategory(input)).resolves.toBe(created)
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { ...input, storeId: "store_1" },
    })
  })

  it("defaults a missing description to null", async () => {
    prisma.category.create.mockResolvedValue({ id: "cat_1" })

    await createCategory({ name: "Beauty", slug: "beauty" })
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: {
        name: "Beauty",
        slug: "beauty",
        description: null,
        storeId: "store_1",
      },
    })
  })

  it("throws when no store exists", async () => {
    mockDefaultStore(null)

    await expect(createCategory(input)).rejects.toThrow(
      "No store found. Create a store before adding categories."
    )
    expect(prisma.category.create).not.toHaveBeenCalled()
  })
})

describe("updateCategory", () => {
  it("updates the category fields", async () => {
    const updated = { id: "cat_1" }
    prisma.category.update.mockResolvedValue(updated)

    await expect(updateCategory("cat_1", input)).resolves.toBe(updated)
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: "cat_1" },
      data: input,
    })
  })

  it("defaults a null description to null", async () => {
    prisma.category.update.mockResolvedValue({ id: "cat_1" })

    await updateCategory("cat_1", { name: "Beauty", slug: "beauty", description: null })
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: "cat_1" },
      data: { name: "Beauty", slug: "beauty", description: null },
    })
  })

  it("throws when no store exists", async () => {
    mockDefaultStore(null)

    await expect(updateCategory("cat_1", input)).rejects.toThrow("No store found.")
    expect(prisma.category.update).not.toHaveBeenCalled()
  })
})

describe("deleteCategory", () => {
  it("deletes the category by id", async () => {
    const deleted = { id: "cat_1" }
    prisma.category.delete.mockResolvedValue(deleted)

    await expect(deleteCategory("cat_1")).resolves.toBe(deleted)
    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: "cat_1" } })
  })

  it("throws when no store exists", async () => {
    mockDefaultStore(null)

    await expect(deleteCategory("cat_1")).rejects.toThrow("No store found.")
    expect(prisma.category.delete).not.toHaveBeenCalled()
  })
})
