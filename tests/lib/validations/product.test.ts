import { describe, expect, it } from "vitest"
import { productSchema } from "@/lib/validations/product"

const validProduct = {
  name: "Wireless Mouse",
  slug: "wireless-mouse",
  description: "A comfortable mouse",
  price: "19.99",
  compareAtPrice: "29.99",
  sku: "WM-001",
  categoryId: "cat_1",
}

function expectMessage(input: unknown, message: string) {
  const result = productSchema.safeParse(input)
  expect(result.success).toBe(false)
  if (result.success) return
  expect(result.error.issues[0]?.message).toBe(message)
}

describe("productSchema", () => {
  it("accepts a fully populated product", () => {
    const result = productSchema.safeParse(validProduct)
    expect(result.success).toBe(true)
  })

  it("accepts null optional fields and an empty compare-at price", () => {
    const result = productSchema.safeParse({
      ...validProduct,
      description: null,
      compareAtPrice: "",
      sku: null,
    })
    expect(result.success).toBe(true)
  })

  it("accepts omitted optional fields", () => {
    const result = productSchema.safeParse({
      name: validProduct.name,
      slug: validProduct.slug,
      price: validProduct.price,
      categoryId: validProduct.categoryId,
    })
    expect(result.success).toBe(true)
  })

  it("rejects an empty name", () => {
    expectMessage({ ...validProduct, name: "" }, "Name is required")
  })

  it("rejects a name longer than 255 characters", () => {
    expectMessage(
      { ...validProduct, name: "a".repeat(256) },
      "Name must be 255 characters or less"
    )
  })

  it("rejects an empty slug", () => {
    expectMessage({ ...validProduct, slug: "" }, "Slug is required")
  })

  it("rejects a slug longer than 255 characters", () => {
    expectMessage(
      { ...validProduct, slug: "a".repeat(256) },
      "Slug must be 255 characters or less"
    )
  })

  it.each(["Wireless Mouse", "wireless_mouse", "-mouse", "mouse-", "mouse--pad"])(
    "rejects the malformed slug %s",
    (slug) => {
      expectMessage(
        { ...validProduct, slug },
        "Slug must be lowercase letters, numbers, and hyphens"
      )
    }
  )

  it("accepts slugs with digits and multiple segments", () => {
    const result = productSchema.safeParse({
      ...validProduct,
      slug: "mouse-2-pro",
    })
    expect(result.success).toBe(true)
  })

  it("rejects a description longer than 5000 characters", () => {
    expectMessage(
      { ...validProduct, description: "a".repeat(5001) },
      "Description must be 5000 characters or less"
    )
  })

  it("rejects an empty price", () => {
    expectMessage({ ...validProduct, price: "" }, "Price is required")
  })

  it.each(["19.999", "abc", "-5", "19.", "1,99"])(
    "rejects the malformed price %s",
    (price) => {
      expectMessage(
        { ...validProduct, price },
        "Price must be a valid amount (e.g. 19.99)"
      )
    }
  )

  it.each(["19", "19.9", "19.99", "0"])("accepts the price %s", (price) => {
    expect(productSchema.safeParse({ ...validProduct, price }).success).toBe(true)
  })

  it("rejects a malformed compare-at price", () => {
    expectMessage(
      { ...validProduct, compareAtPrice: "29.999" },
      "Compare-at price must be a valid amount (e.g. 19.99)"
    )
  })

  it("rejects a SKU longer than 100 characters", () => {
    expectMessage(
      { ...validProduct, sku: "a".repeat(101) },
      "SKU must be 100 characters or less"
    )
  })

  it("rejects a missing category", () => {
    expectMessage({ ...validProduct, categoryId: "" }, "Category is required")
  })
})
