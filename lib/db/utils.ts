import { getDefaultStoreId } from "./store"

/**
 * Runs a read query scoped to the default store.
 * Returns `fallback` when no store exists yet.
 */
export async function withStore<T>(
  query: (storeId: string) => Promise<T>,
  fallback: T
): Promise<T> {
  const storeId = await getDefaultStoreId()
  if (!storeId) return fallback

  return query(storeId)
}

/**
 * Returns the default store id, throwing when no store exists.
 * Used by mutations, which cannot silently no-op.
 */
export async function requireStoreId(
  message = "No store found."
): Promise<string> {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error(message)
  }

  return storeId
}
