/**
 * ShopNova - Cart store abstraction.
 *
 * The guidebook architecture calls for a Redis-backed cart. Redis is NOT
 * currently configured in this repository (no dependency, no REDIS_URL /
 * UPSTASH_REDIS_REST_URL env var). To avoid introducing unnecessary
 * infrastructure during local development, cart persistence is defined
 * behind a small CartStore interface:
 *
 *   - `MemoryCartStore`  -> development store (survives warm requests via
 *     the module global, so the cart persists across page navigation when
 *     the dev server keeps running).
 *   - A future `RedisCartStore` can drop in without touching cart business
 *     logic, sessions, actions, or UI.
 *
 * Production note: an in-memory store does NOT survive server restart and
 * is not shared across multiple server instances. Before production, set
 * REDIS_URL and add a RedisCartStore implementation. Cart business logic
 * never depends on the concrete store.
 */
import "server-only"

import type { Cart } from "@/types/cart"

/** Persistence contract shared by every cart backend. */
export interface CartStore {
  /** Returns the persisted cart for a shopper, or null if none exists. */
  getCart(shopperId: string): Promise<Cart | null>

  /** Persists the cart for a shopper. */
  saveCart(shopperId: string, cart: Cart): Promise<void>

  /** Removes the persisted cart for a shopper. */
  deleteCart(shopperId: string): Promise<void>
}

/** Reference to REDIS_URL used when adding a RedisCartStore later. */
const REDIS_URL = process.env.REDIS_URL

// ── Development store ─────────────────────────

interface MemoryEntry {
  cart: Cart
  expiresAt: number
}

const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

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
 * page navigation while the dev server runs. Persists for 30 days.
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

// ── Singleton ─────────────────────────────────

/**
 * The cart store used by the application.
 *
 * When REDIS_URL is configured in the future, swap the initializer here
 * (e.g. `RedisCartStore`) without changing any other module.
 */
const store: CartStore = new MemoryCartStore()

export const cartStore = store

// Document the Redis state explicitly so it is visible in code.
export const REDIS_CONFIGURED = Boolean(REDIS_URL)