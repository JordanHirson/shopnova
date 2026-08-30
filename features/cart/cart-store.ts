/**
 * ShopNova - Cart store abstraction and selection.
 *
 * The guidebook architecture calls for a Redis-backed cart (Upstash). This
 * module defines the provider-agnostic `CartStore` contract and selects the
 * active backend:
 *
 *   - `RedisCartStore`  -> production store (Upstash Redis REST API) when
 *     `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured.
 *   - `MemoryCartStore` -> development-only fallback when Redis credentials
 *     are absent. NOT production-ready (no cross-instance sharing, no restart
 *     survival).
 *
 * Selection rules:
 *   - Redis credentials present        -> RedisCartStore (any environment).
 *   - Redis credentials absent + dev   -> MemoryCartStore (local DX).
 *   - Redis credentials absent + prod  -> fail fast with an actionable
 *     configuration error. Production MUST NOT silently fall back to an
 *     in-memory cart (that would silently lose cart persistence).
 *
 * The store is resolved lazily on first use (not at module load) so that
 * `next build` — which evaluates server modules in `NODE_ENV=production` —
 * does not require Redis credentials to be present at build time. Credentials
 * are a runtime concern.
 *
 * Cart business logic, sessions, actions, and UI never depend on the concrete
 * store; they only depend on the `CartStore` interface exported here.
 */
import "server-only"

import { Redis } from "@upstash/redis"

import type { Cart } from "@/types/cart"
import {
  CART_TTL_SECONDS,
  RedisCartStore,
  type RedisLike,
} from "./redis-cart-store.ts"

/** Persistence contract shared by every cart backend. */
export interface CartStore {
  /** Returns the persisted cart for a shopper, or null if none exists. */
  getCart(shopperId: string): Promise<Cart | null>

  /** Persists the cart for a shopper. */
  saveCart(shopperId: string, cart: Cart): Promise<void>

  /** Removes the persisted cart for a shopper. */
  deleteCart(shopperId: string): Promise<void>
}

// Re-exported so callers and tests can import cart-store concerns from one
// module without reaching into the redis implementation file.
export { CART_TTL_SECONDS, RedisCartStore }
export type { RedisLike }

/** Environment variable names used to configure Upstash Redis. */
export const UPSTASH_REDIS_REST_URL_ENV = "UPSTASH_REDIS_REST_URL"
export const UPSTASH_REDIS_REST_TOKEN_ENV = "UPSTASH_REDIS_REST_TOKEN"

/**
 * Returns true when both Upstash Redis REST credentials are present.
 * Used for selection and for tests; never logs the values.
 */
export function isRedisConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(
    env[UPSTASH_REDIS_REST_URL_ENV] && env[UPSTASH_REDIS_REST_TOKEN_ENV]
  )
}

/**
 * Error thrown when production starts without Redis cart configuration.
 * The message is actionable and contains no credentials.
 */
export class CartConfigurationError extends Error {
  constructor() {
    super(
      "ShopNova cart persistence is not configured. " +
        "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN " +
        "to enable the Redis cart store (required in production)."
    )
    this.name = "CartConfigurationError"
  }
}

// ── Development store ─────────────────────────

interface MemoryEntry {
  cart: Cart
  expiresAt: number
}

const TTL_MS = CART_TTL_SECONDS * 1000 // 30 days, kept in sync with Redis TTL

const globalForMemoryStore = globalThis as unknown as {
  shopnovaCartStore?: Map<string, MemoryEntry>
}

function getMemoryMap(): Map<string, MemoryEntry> {
  const existing = globalForMemoryStore.shopnovaCartStore
  if (existing) return existing

  const map = new Map<string, MemoryEntry>()
  globalForMemoryStore.shopnovaCartStore = map
  return map
}

/**
 * In-memory cart store for local development.
 *
 * Uses a module-level Map (hoisted on globalThis) so the cart survives
 * page navigation while the dev server runs. Persists for 30 days. NOT
 * production-ready: carts are not shared across instances and do not survive
 * a server restart.
 */
export class MemoryCartStore implements CartStore {
  private readonly memory = getMemoryMap()

  async getCart(shopperId: string): Promise<Cart | null> {
    const entry = this.memory.get(shopperId)
    if (!entry) return null

    if (entry.expiresAt < Date.now()) {
      this.memory.delete(shopperId)
      return null
    }

    return entry.cart
  }

  async saveCart(shopperId: string, cart: Cart): Promise<void> {
    this.memory.set(shopperId, {
      cart,
      expiresAt: Date.now() + TTL_MS,
    })
  }

  async deleteCart(shopperId: string): Promise<void> {
    this.memory.delete(shopperId)
  }
}

// ── Selection ─────────────────────────────────

/**
 * Pure, testable selection of the active cart store.
 *
 * @param env       environment snapshot (defaults to process.env).
 * @param nodeEnv   NODE_ENV value (defaults to process.env.NODE_ENV).
 * @param makeRedis factory that builds a RedisCartStore from a RedisLike
 *                  client. Defaults to the real Upstash client built from env.
 * @returns the selected CartStore.
 * @throws CartConfigurationError when production has no Redis credentials.
 */
export function selectCartStore(
  env: Record<string, string | undefined> = process.env,
  nodeEnv: string | undefined = process.env.NODE_ENV,
  makeRedis: (client: RedisLike) => CartStore = (client) =>
    new RedisCartStore(client)
): CartStore {
  if (isRedisConfigured(env)) {
    const client = new Redis({
      url: env[UPSTASH_REDIS_REST_URL_ENV],
      token: env[UPSTASH_REDIS_REST_TOKEN_ENV],
    })
    return makeRedis(client)
  }

  if (nodeEnv === "production") {
    throw new CartConfigurationError()
  }

  return new MemoryCartStore()
}

// ── Lazy singleton ────────────────────────────

let resolvedStore: CartStore | null = null

function resolveStore(): CartStore {
  if (resolvedStore) return resolvedStore
  resolvedStore = selectCartStore()
  return resolvedStore
}

/**
 * The cart store used by the application.
 *
 * Lazily resolves to RedisCartStore (when configured), MemoryCartStore (in
 * development without Redis), or throws CartConfigurationError (in production
 * without Redis). Lazy resolution keeps `next build` credential-free.
 */
export const cartStore: CartStore = {
  getCart: (shopperId: string) => resolveStore().getCart(shopperId),
  saveCart: (shopperId: string, cart: Cart) =>
    resolveStore().saveCart(shopperId, cart),
  deleteCart: (shopperId: string) => resolveStore().deleteCart(shopperId),
}

/** True when the active (or to-be-active) store is the Redis backend. */
export const REDIS_CONFIGURED = isRedisConfigured()
