import { describe, expect, it } from "vitest"
import { cn } from "@/lib/utils"

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1")
  })

  it("keeps the last conflicting tailwind class", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("ignores falsy values and supports conditional objects and arrays", () => {
    expect(cn("base", false, null, undefined, ["a", { b: true, c: false }])).toBe(
      "base a b"
    )
  })

  it("returns an empty string when no classes are given", () => {
    expect(cn()).toBe("")
  })
})
