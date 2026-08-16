import { beforeEach, describe, expect, it, vi } from "vitest"

const db = vi.hoisted(() => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}))
const revalidatePath = vi.hoisted(() => vi.fn())

vi.mock("@/lib/db", () => db)
vi.mock("next/cache", () => ({ revalidatePath }))

const {
  createProductAction,
  updateProductAction,
  deleteProductAction,
} = await import("@/app/(dashboard)/dashboard/products/actions")

function formData(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}

const validFields = {
  name: "Wireless Mouse",
  slug: "wireless-mouse",
  description: "Comfortable",
  price: "19.99",
  compareAtPrice: "29.99",
  sku: "WM-001",
  categoryId: "cat_1",
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("createProductAction", () => {
  it("creates the product and revalidates the dashboard list", async () => {
    await expect(createProductAction({}, formData(validFields))).resolves.toEqual({})
    expect(db.createProduct).toHaveBeenCalledWith(validFields)
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/products")
  })

  it("coerces blank optional fields to null", async () => {
    await createProductAction(
      {},
      formData({ ...validFields, description: "", compareAtPrice: "", sku: "" })
    )
    expect(db.createProduct).toHaveBeenCalledWith({
      ...validFields,
      description: null,
      compareAtPrice: null,
      sku: null,
    })
  })

  it("returns the first validation error and skips the write", async () => {
    const result = await createProductAction(
      {},
      formData({ ...validFields, name: "" })
    )

    expect(result).toEqual({ error: "Name is required" })
    expect(db.createProduct).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("returns the error message when the write fails", async () => {
    db.createProduct.mockRejectedValue(new Error("Unique constraint failed"))

    await expect(createProductAction({}, formData(validFields))).resolves.toEqual({
      error: "Unique constraint failed",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("falls back to a generic message for non-Error rejections", async () => {
    db.createProduct.mockRejectedValue("boom")

    await expect(createProductAction({}, formData(validFields))).resolves.toEqual({
      error: "Failed to create product.",
    })
  })
})

describe("updateProductAction", () => {
  it("updates the product and revalidates the dashboard list", async () => {
    await expect(
      updateProductAction({}, formData({ id: "prod_1", ...validFields }))
    ).resolves.toEqual({})
    expect(db.updateProduct).toHaveBeenCalledWith("prod_1", validFields)
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/products")
  })

  it("requires an id", async () => {
    await expect(updateProductAction({}, formData(validFields))).resolves.toEqual({
      error: "Product id is required.",
    })
    expect(db.updateProduct).not.toHaveBeenCalled()
  })

  it("returns the first validation error", async () => {
    await expect(
      updateProductAction({}, formData({ id: "prod_1", ...validFields, price: "abc" }))
    ).resolves.toEqual({ error: "Price must be a valid amount (e.g. 19.99)" })
    expect(db.updateProduct).not.toHaveBeenCalled()
  })

  it("returns the error message when the write fails", async () => {
    db.updateProduct.mockRejectedValue(new Error("Record not found"))

    await expect(
      updateProductAction({}, formData({ id: "prod_1", ...validFields }))
    ).resolves.toEqual({ error: "Record not found" })
  })

  it("falls back to a generic message for non-Error rejections", async () => {
    db.updateProduct.mockRejectedValue("boom")

    await expect(
      updateProductAction({}, formData({ id: "prod_1", ...validFields }))
    ).resolves.toEqual({ error: "Failed to update product." })
  })
})

describe("deleteProductAction", () => {
  it("deletes the product and revalidates the dashboard list", async () => {
    await expect(
      deleteProductAction({}, formData({ id: "prod_1" }))
    ).resolves.toEqual({})
    expect(db.deleteProduct).toHaveBeenCalledWith("prod_1")
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/products")
  })

  it("requires an id", async () => {
    await expect(deleteProductAction({}, formData({ id: "" }))).resolves.toEqual({
      error: "Product id is required.",
    })
    expect(db.deleteProduct).not.toHaveBeenCalled()
  })

  it("returns the error message when the delete fails", async () => {
    db.deleteProduct.mockRejectedValue(new Error("Foreign key constraint"))

    await expect(
      deleteProductAction({}, formData({ id: "prod_1" }))
    ).resolves.toEqual({ error: "Foreign key constraint" })
  })

  it("falls back to a generic message for non-Error rejections", async () => {
    db.deleteProduct.mockRejectedValue("boom")

    await expect(
      deleteProductAction({}, formData({ id: "prod_1" }))
    ).resolves.toEqual({ error: "Failed to delete product." })
  })
})
