import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma, mockDefaultStore } from "@/tests/helpers/prisma-mock"
import { getDefaultStore, getDefaultStoreId } from "@/lib/db/store"

vi.mock("@/lib/db/prisma", () => import("@/tests/helpers/prisma-mock"))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getDefaultStore", () => {
  it("returns the oldest store", async () => {
    const store = { id: "store_1", name: "ShopNova" }
    mockDefaultStore(store)

    await expect(getDefaultStore()).resolves.toBe(store)
    expect(prisma.store.findFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: "asc" },
    })
  })

  it("returns null when no store exists", async () => {
    mockDefaultStore(null)
    await expect(getDefaultStore()).resolves.toBeNull()
  })
})

describe("getDefaultStoreId", () => {
  it("returns the store id", async () => {
    mockDefaultStore({ id: "store_1" })
    await expect(getDefaultStoreId()).resolves.toBe("store_1")
  })

  it("returns null when no store exists", async () => {
    mockDefaultStore(null)
    await expect(getDefaultStoreId()).resolves.toBeNull()
  })
})
