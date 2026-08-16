import { prisma } from "./prisma"
import { logWarning } from "../errors"

/**
 * Returns the first store in the database.
 *
 * Authentication is not implemented yet, so the dashboard operates
 * against a single default store. This helper centralizes that lookup.
 */
export async function getDefaultStore() {
  return prisma.store.findFirst({
    orderBy: { createdAt: "asc" },
  })
}

/**
 * Returns the id of the default store, or null if no store exists.
 */
export async function getDefaultStoreId(): Promise<string | null> {
  const store = await getDefaultStore()
  if (!store) {
    logWarning(
      "getDefaultStoreId",
      "no store exists — reads will look empty. Run `npm run db:seed`."
    )
    return null
  }
  return store.id
}