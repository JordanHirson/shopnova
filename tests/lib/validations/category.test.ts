import { describe, expect, it } from "vitest"
import { categorySchema } from "@/lib/validations/category"

const validCategory = {
  name: "Electronics",
  slug: "electronics",
  description: "Gadgets and devices",
}

function expectMessage(input: unknown, message: string) {
  const result = categorySchema.safeParse(input)
  expect(result.success).toBe(false)
  if (result.success) return
  expect(result.error.issues[0]?.message).toBe(message)
}

describe("categorySchema", () => {
  it("accepts a fully populated category", () => {
    expect(categorySchema.safeParse(validCategory).success).toBe(true)
  })

  it("accepts a null description", () => {
    expect(
      categorySchema.safeParse({ ...validCategory, description: null }).success
    ).toBe(true)
  })

  it("accepts an omitted description", () => {
    expect(
      categorySchema.safeParse({ name: "Beauty", slug: "beauty" }).success
    ).toBe(true)
  })

  it("rejects an empty name", () => {
    expectMessage({ ...validCategory, name: "" }, "Name is required")
  })

  it("rejects a name longer than 255 characters", () => {
    expectMessage(
      { ...validCategory, name: "a".repeat(256) },
      "Name must be 255 characters or less"
    )
  })

  it("rejects an empty slug", () => {
    expectMessage({ ...validCategory, slug: "" }, "Slug is required")
  })

  it("rejects a slug longer than 255 characters", () => {
    expectMessage(
      { ...validCategory, slug: "a".repeat(256) },
      "Slug must be 255 characters or less"
    )
  })

  it.each(["Home & Living", "home_living", "-home", "home-", "home--living"])(
    "rejects the malformed slug %s",
    (slug) => {
      expectMessage(
        { ...validCategory, slug },
        "Slug must be lowercase letters, numbers, and hyphens"
      )
    }
  )

  it("accepts a multi-segment slug with digits", () => {
    expect(
      categorySchema.safeParse({ ...validCategory, slug: "sports-2-outdoors" })
        .success
    ).toBe(true)
  })

  it("rejects a description longer than 5000 characters", () => {
    expectMessage(
      { ...validCategory, description: "a".repeat(5001) },
      "Description must be 5000 characters or less"
    )
  })
})
