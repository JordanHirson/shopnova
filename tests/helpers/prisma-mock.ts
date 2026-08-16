import { vi } from "vitest"

/**
 * Minimal in-memory stand-in for the Prisma client, used to unit test the
 * `lib/db` query helpers and the dashboard server actions without a database.
 *
 * Register it with `vi.mock("@/lib/db/prisma", () => import("@/tests/helpers/prisma-mock"))`.
 */
export const prisma = {
  store: {
    findFirst: vi.fn(),
  },
  category: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}

/** Resets all mock calls and makes the default store resolve to `store`. */
export function mockDefaultStore(store: { id: string } | null) {
  prisma.store.findFirst.mockResolvedValue(store)
}
