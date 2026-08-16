import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma, mockDefaultStore } from "@/tests/helpers/prisma-mock"
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProductBySlug,
  listFeaturedProducts,
  listProducts,
  listProductsByCategory,
  listStorefrontProducts,
  updateProduct,
} from "@/lib/db/products"

vi.mock("@/lib/db/prisma", () => import("@/tests/helpers/prisma-mock"))

const input = {
  name: "Wireless Mouse",
  slug: "wireless-mouse",
  description: "Comfortable",
  price: "19.99",
  compareAtPrice: "29.99",
  sku: "WM-001",
  categoryId: "cat_1",
}

const storefrontInclude = {
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1 },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDefaultStore({ id: "store_1" })
})

describe("listProducts", () => {
  it("lists dashboard products with their category", async () => {
    const products = [{ id: "prod_1" }]
    prisma.product.findMany.mockResolvedValue(products)

    await expect(listProducts()).resolves.toBe(products)
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { storeId: "store_1" },
      orderBy: { name: "asc" },
      include: { category: { select: { id: true, name: true } } },
    })
  })

  it("returns an empty list when no store exists", async () => {
    mockDefaultStore(null)

    await expect(listProducts()).resolves.toEqual([])
    expect(prisma.product.findMany).not.toHaveBeenCalled()
  })
})

describe("getProductById", () => {
  it("scopes the lookup to the default store", async () => {
    const product = { id: "prod_1" }
    prisma.product.findFirst.mockResolvedValue(product)

    await expect(getProductById("prod_1")).resolves.toBe(product)
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: "prod_1", storeId: "store_1" },
      include: { category: { select: { id: true, name: true } } },
    })
  })

  it("returns null when no store exists", async () => {
    mockDefaultStore(null)

    await expect(getProductById("prod_1")).resolves.toBeNull()
    expect(prisma.product.findFirst).not.toHaveBeenCalled()
  })
})

describe("getProductBySlug", () => {
  it("includes the category and sorted images", async () => {
    const product = { id: "prod_1" }
    prisma.product.findFirst.mockResolvedValue(product)

    await expect(getProductBySlug("wireless-mouse")).resolves.toBe(product)
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { slug: "wireless-mouse", storeId: "store_1" },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    })
  })

  it("returns null when no store exists", async () => {
    mockDefaultStore(null)

    await expect(getProductBySlug("wireless-mouse")).resolves.toBeNull()
    expect(prisma.product.findFirst).not.toHaveBeenCalled()
  })
})

describe("listStorefrontProducts", () => {
  it("lists products alphabetically with their primary image", async () => {
    prisma.product.findMany.mockResolvedValue([])

    await listStorefrontProducts()
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { storeId: "store_1" },
      orderBy: { name: "asc" },
      include: storefrontInclude,
    })
  })

  it("returns an empty list when no store exists", async () => {
    mockDefaultStore(null)

    await expect(listStorefrontProducts()).resolves.toEqual([])
    expect(prisma.product.findMany).not.toHaveBeenCalled()
  })
})

describe("listFeaturedProducts", () => {
  it("takes the 8 newest products by default", async () => {
    prisma.product.findMany.mockResolvedValue([])

    await listFeaturedProducts()
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { storeId: "store_1" },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: storefrontInclude,
    })
  })

  it("honours a custom limit", async () => {
    prisma.product.findMany.mockResolvedValue([])

    await listFeaturedProducts(3)
    expect(prisma.product.findMany.mock.calls[0][0]).toMatchObject({ take: 3 })
  })

  it("returns an empty list when no store exists", async () => {
    mockDefaultStore(null)

    await expect(listFeaturedProducts()).resolves.toEqual([])
    expect(prisma.product.findMany).not.toHaveBeenCalled()
  })
})

describe("listProductsByCategory", () => {
  it("filters by the category slug", async () => {
    prisma.product.findMany.mockResolvedValue([])

    await listProductsByCategory("electronics")
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { storeId: "store_1", category: { slug: "electronics" } },
      orderBy: { name: "asc" },
      include: storefrontInclude,
    })
  })

  it("returns an empty list when no store exists", async () => {
    mockDefaultStore(null)

    await expect(listProductsByCategory("electronics")).resolves.toEqual([])
    expect(prisma.product.findMany).not.toHaveBeenCalled()
  })
})

describe("createProduct", () => {
  it("creates the product against the default store", async () => {
    const created = { id: "prod_1" }
    prisma.product.create.mockResolvedValue(created)

    await expect(createProduct(input)).resolves.toBe(created)
    expect(prisma.product.create).toHaveBeenCalledWith({
      data: { ...input, storeId: "store_1" },
    })
  })

  it("defaults missing optional fields to null", async () => {
    prisma.product.create.mockResolvedValue({ id: "prod_1" })

    await createProduct({
      name: input.name,
      slug: input.slug,
      price: input.price,
      categoryId: input.categoryId,
    })
    expect(prisma.product.create).toHaveBeenCalledWith({
      data: {
        name: input.name,
        slug: input.slug,
        description: null,
        price: input.price,
        compareAtPrice: null,
        sku: null,
        categoryId: input.categoryId,
        storeId: "store_1",
      },
    })
  })

  it("throws when no store exists", async () => {
    mockDefaultStore(null)

    await expect(createProduct(input)).rejects.toThrow(
      "No store found. Create a store before adding products."
    )
    expect(prisma.product.create).not.toHaveBeenCalled()
  })
})

describe("updateProduct", () => {
  it("updates the product fields", async () => {
    const updated = { id: "prod_1" }
    prisma.product.update.mockResolvedValue(updated)

    await expect(updateProduct("prod_1", input)).resolves.toBe(updated)
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: "prod_1" },
      data: input,
    })
  })

  it("normalizes null optional fields", async () => {
    prisma.product.update.mockResolvedValue({ id: "prod_1" })

    await updateProduct("prod_1", {
      ...input,
      description: null,
      compareAtPrice: null,
      sku: null,
    })
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: "prod_1" },
      data: { ...input, description: null, compareAtPrice: null, sku: null },
    })
  })

  it("throws when no store exists", async () => {
    mockDefaultStore(null)

    await expect(updateProduct("prod_1", input)).rejects.toThrow("No store found.")
    expect(prisma.product.update).not.toHaveBeenCalled()
  })
})

describe("deleteProduct", () => {
  it("deletes the product by id", async () => {
    const deleted = { id: "prod_1" }
    prisma.product.delete.mockResolvedValue(deleted)

    await expect(deleteProduct("prod_1")).resolves.toBe(deleted)
    expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: "prod_1" } })
  })

  it("throws when no store exists", async () => {
    mockDefaultStore(null)

    await expect(deleteProduct("prod_1")).rejects.toThrow("No store found.")
    expect(prisma.product.delete).not.toHaveBeenCalled()
  })
})
