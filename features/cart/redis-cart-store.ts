/**
 * ShopNova - Redis-backed cart store.
 *
 * Production cart persistence using Upstash Redis (REST API). Upstash is the
 * guidebook's chosen cache and is the recommended Redis provider for
 * Next.js/Vercel serverless deployments because its REST client works over
 * plain HTTPS (no long-lived TCP connection, no connection-pool sizing).
 *
 * This module is provider-agnostic at the CartStore level: it depends only on
 * a small `RedisLike` surface (get/set/del) that the official `@upstash/redis`
 * `Redis` client satisfies. Tests inject a fake `RedisLike` so `npm test`
 * never requires real Redis credentials.
 *
 * Key design:
 *   - `cart:<shopper-id>` — namespaced, stable, per-shopper. The shopper id is
 *     `user:<clerkUserId>` or `anon:<uuid>` (see features/cart/session.ts); it
 *     contains no personal data beyond an opaque id, and is already unique per
 *     shopper so carts from different shoppers cannot collide.
 *   - 30-day TTL (`CART_TTL_SECONDS`), refreshed on every write via the atomic
 *     `SET ... EX` call (single round trip, no separate EXPIRE race).
 *   - Only the cart data needed by the cart architecture is stored (no full
 *     Prisma Product records). Money is stored as the existing number snapshot
 *     captured at add-to-cart time; checkout re-reads authoritative prices
 *     from PostgreSQL, so the persisted snapshot is display-only.
 *
 * Concurrency limitation (documented):
 *   Cart mutations in features/cart/actions.ts follow a load → mutate → save
 *   cycle. Two simultaneous mutations for the same shopper could therefore
 *   race (last write wins). The `SET ... EX` write itself is atomic, but the
 *   read-modify-write window is not. This matches the existing MVP
 *   architecture (the in-memory store had the same property) and is acceptable
 *   for a single-shopper cart; distributed locking is intentionally not added.
 */
import "server-only"

import type { Cart, CartItem } from "@/types/cart"
import type { CartStore } from "./cart-store"

/** 30-day cart lifetime, per the guidebook (`60 * 60 * 24 * 30`). */
export const CART_TTL_SECONDS = 60 * 60 * 24 * 30

/** Redis key prefix; the full key is `cart:<shopper-id>`. */
export const CART_KEY_PREFIX = "cart:"

/**
 * Minimal Redis surface used by the cart store. The official
 * `@upstash/redis` `Redis` client satisfies this; tests pass a fake.
 */
export interface RedisLike {
  /** Returns the value stored at `key`, or null when missing. */
  get<T = string>(key: string): Promise<T | null>
  /** Sets `key` to `value`, optionally with an expiry in seconds (`ex`). */
  set(key: string, value: string, opts?: { ex?: number }): Promise<unknown>
  /** Removes `key`; returns the number of keys deleted. */
  del(key: string): Promise<number>
}

/** Builds the Redis key for a shopper's cart. */
export function cartKey(shopperId: string): string {
  return `${CART_KEY_PREFIX}${shopperId}`
}

/** Shape used for JSON serialization (exactly the persisted Cart). */
interface SerializedCart {
  items: CartItem[]
  updatedAt: string
}

/**
 * Serializes a cart to a JSON string for storage.
 *
 * Money values (unitPrice, lineTotal) are stored as the existing JS number
 * snapshot. JSON round-trips these exactly for the decimal magnitudes used by
 * the catalog, and checkout never trusts them — it re-reads authoritative
 * prices from PostgreSQL. `updatedAt` is already an ISO string.
 */
export function serializeCart(cart: Cart): string {
  const value: SerializedCart = { items: cart.items, updatedAt: cart.updatedAt }
  return JSON.stringify(value)
}

/**
 * Deserializes a cart from storage. Returns null when the payload is missing
 * or does not look like a cart, so a corrupt/foreign value degrades to an
 * empty cart instead of crashing the storefront.
 */
export function deserializeCart(raw: string | null): Cart | null {
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof parsed !== "object" || parsed === null) return null
  const obj = parsed as Record<string, unknown>

  if (!Array.isArray(obj.items)) return null
  if (typeof obj.updatedAt !== "string") return null

  const items: CartItem[] = []
  for (const entry of obj.items) {
    if (typeof entry !== "object" || entry === null) return null
    const line = entry as Record<string, unknown>
    if (
      typeof line.productId !== "string" ||
      typeof line.name !== "string" ||
      typeof line.slug !== "string" ||
      (line.imageUrl !== null && typeof line.imageUrl !== "string") ||
      typeof line.unitPrice !== "number" ||
      typeof line.quantity !== "number" ||
      typeof line.lineTotal !== "number"
    ) {
      return null
    }
    const item: CartItem = {
      productId: line.productId,
      name: line.name,
      slug: line.slug,
      imageUrl: line.imageUrl as string | null,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
    }
    if (typeof line.archived === "boolean") {
      item.archived = line.archived
    }
    items.push(item)
  }

  return { items, updatedAt: obj.updatedAt }
}

/**
 * Error thrown when the Redis cart store cannot complete an operation.
 *
 * The message is intentionally generic so it is safe to surface; the original
 * driver error is preserved on `cause` for server-side debugging and never
 * contains Redis credentials (those live only on the client config).
 */
export class CartStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "CartStoreError"
  }
}

/**
 * Redis-backed CartStore.
 *
 * @param redis A `RedisLike` client (e.g. an `@upstash/redis` `Redis`
 *              instance, or a fake in tests).
 */
export class RedisCartStore implements CartStore {
  private readonly redis: RedisLike

  constructor(redis: RedisLike) {
    this.redis = redis
  }

  async getCart(shopperId: string): Promise<Cart | null> {
    try {
      const raw = await this.redis.get<string>(cartKey(shopperId))
      return deserializeCart(typeof raw === "string" ? raw : null)
    } catch (err) {
      throw new CartStoreError("Cart storage is temporarily unavailable.", {
        cause: err,
      })
    }
  }

  async saveCart(shopperId: string, cart: Cart): Promise<void> {
    try {
      // Atomic SET + EX in a single round trip: the TTL is refreshed on every
      // write, so an active shopper's cart never expires out from under them.
      await this.redis.set(cartKey(shopperId), serializeCart(cart), {
        ex: CART_TTL_SECONDS,
      })
    } catch (err) {
      throw new CartStoreError("Cart storage is temporarily unavailable.", {
        cause: err,
      })
    }
  }

  async deleteCart(shopperId: string): Promise<void> {
    try {
      await this.redis.del(cartKey(shopperId))
    } catch (err) {
      throw new CartStoreError("Cart storage is temporarily unavailable.", {
        cause: err,
      })
    }
  }
}
