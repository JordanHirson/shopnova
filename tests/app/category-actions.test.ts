import { beforeEach, describe, expect, it, vi } from "vitest"

const db = vi.hoisted(() => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))
const revalidatePath = vi.hoisted(() => vi.fn())

vi.mock("@/lib/db", () => db)
vi.mock("next/cache", () => ({ revalidatePath }))

const {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} = await import("@/app/(dashboard)/dashboard/categories/actions")

function formData(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}

const validFields = {
  name: "Electronics",
  slug: "electronics",
  description: "Gadgets",
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("createCategoryAction", () => {
  it("creates the category and revalidates the dashboard list", async () => {
    await expect(createCategoryAction({}, formData(validFields))).resolves.toEqual({})
    expect(db.createCategory).toHaveBeenCalledWith(validFields)
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/categories")
  })

  it("coerces a blank description to null", async () => {
    await createCategoryAction({}, formData({ ...validFields, description: "" }))
    expect(db.createCategory).toHaveBeenCalledWith({
      ...validFields,
      description: null,
    })
  })

  it("returns the first validation error and skips the write", async () => {
    await expect(
      createCategoryAction({}, formData({ ...validFields, slug: "Electronics" }))
    ).resolves.toEqual({
      error: "Slug must be lowercase letters, numbers, and hyphens",
    })
    expect(db.createCategory).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("returns the error message when the write fails", async () => {
    db.createCategory.mockRejectedValue(new Error("No store found."))

    await expect(createCategoryAction({}, formData(validFields))).resolves.toEqual({
      error: "No store found.",
    })
  })

  it("falls back to a generic message for non-Error rejections", async () => {
    db.createCategory.mockRejectedValue("boom")

    await expect(createCategoryAction({}, formData(validFields))).resolves.toEqual({
      error: "Failed to create category.",
    })
  })
})

describe("updateCategoryAction", () => {
  it("updates the category and revalidates the dashboard list", async () => {
    await expect(
      updateCategoryAction({}, formData({ id: "cat_1", ...validFields }))
    ).resolves.toEqual({})
    expect(db.updateCategory).toHaveBeenCalledWith("cat_1", validFields)
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/categories")
  })

  it("requires an id", async () => {
    await expect(updateCategoryAction({}, formData(validFields))).resolves.toEqual({
      error: "Category id is required.",
    })
    expect(db.updateCategory).not.toHaveBeenCalled()
  })

  it("returns the first validation error", async () => {
    await expect(
      updateCategoryAction({}, formData({ id: "cat_1", ...validFields, name: "" }))
    ).resolves.toEqual({ error: "Name is required" })
    expect(db.updateCategory).not.toHaveBeenCalled()
  })

  it("returns the error message when the write fails", async () => {
    db.updateCategory.mockRejectedValue(new Error("Record not found"))

    await expect(
      updateCategoryAction({}, formData({ id: "cat_1", ...validFields }))
    ).resolves.toEqual({ error: "Record not found" })
  })

  it("falls back to a generic message for non-Error rejections", async () => {
    db.updateCategory.mockRejectedValue("boom")

    await expect(
      updateCategoryAction({}, formData({ id: "cat_1", ...validFields }))
    ).resolves.toEqual({ error: "Failed to update category." })
  })
})

describe("deleteCategoryAction", () => {
  it("deletes the category and revalidates the dashboard list", async () => {
    await expect(
      deleteCategoryAction({}, formData({ id: "cat_1" }))
    ).resolves.toEqual({})
    expect(db.deleteCategory).toHaveBeenCalledWith("cat_1")
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/categories")
  })

  it("requires an id", async () => {
    await expect(deleteCategoryAction({}, formData({ id: "" }))).resolves.toEqual({
      error: "Category id is required.",
    })
    expect(db.deleteCategory).not.toHaveBeenCalled()
  })

  it("returns the error message when the delete fails", async () => {
    db.deleteCategory.mockRejectedValue(new Error("Category still has products"))

    await expect(
      deleteCategoryAction({}, formData({ id: "cat_1" }))
    ).resolves.toEqual({ error: "Category still has products" })
  })

  it("falls back to a generic message for non-Error rejections", async () => {
    db.deleteCategory.mockRejectedValue("boom")

    await expect(
      deleteCategoryAction({}, formData({ id: "cat_1" }))
    ).resolves.toEqual({ error: "Failed to delete category." })
  })
})
