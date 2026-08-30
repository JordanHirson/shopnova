/**
 * ShopNova - Redis cart store + selection unit tests.
 *
 * Run with the project test runner (`npm test`). Uses a fake `RedisLike`
 * client so no real Redis service or credentials are required.
 */
import { test } from "node:test"
import assert from "node:assert/strict"

import type { Cart, CartItemData } from "../../types/cart"
import {
  addItemToCart,
  createEmptyCart,
  removeCartItem,
} from "./cart-logic.ts"
import {
  CART_KEY_PREFIX,
  CART_TTL_SECONDS,
  CartStoreError,
  RedisCartStore,
  cartKey,
  deserializeCart,
  serializeCart,
  type RedisLike,
} from "./redis-cart-store.ts"
import {
  CartConfigurationError,
  MemoryCartStore,
  REDIS_CONFIGURED,
  isRedisConfigured,
  selectCartStore,
} from "./cart-store.ts"

// ── Fake Redis ────────────────────────────────────────────────

interface FakeEntry {
  value: string
  ex: number | undefined
}

/**
 * In-memory fake of the Upstash Redis REST surface used by the cart store.
 * Records the last `ex` so TTL behavior can be asserted. Optionally fails
 * on demand to exercise error handling.
 */
class FakeRedis implements RedisLike {
  readonly store = new Map<string, FakeEntry>()
  public shouldFail = false
  public setCalls: Array<{ key: string; value: string; ex?: number }> = []

  async get<T = string>(key: string): Promise<T | null> {
    if (this.shouldFail) throw new Error("upstash: network down (url=secret)")
    const entry = this.store.get(key)
    return (entry ? entry.value : null) as T | null
  }

  async set(
    key: string,
    value: string,
    opts?: { ex?: number }
  ): Promise<string> {
    if (this.shouldFail) throw new Error("upstash: network down (url=secret)")
    this.setCalls.push({ key, value, ex: opts?.ex })
    this.store.set(key, { value, ex: opts?.ex })
    return "OK"
  }

  async del(key: string): Promise<number> {
    if (this.shouldFail) throw new Error("upstash: network down (url=secret)")
    return this.store.delete(key) ? 1 : 0
  }
}

// ── Fixtures ──────────────────────────────────────────────────

function makeLine(overrides: Partial<CartItemData> = {}): CartItemData {
  return {
    productId: "p1",
    name: "Widget",
    slug: "widget",
    imageUrl: "https://example.com/img.png",
    unitPrice: 19.99,
    quantity: 2,
    ...overrides,
  }
}

function buildCart(): Cart {
  const cart = createEmptyCart()
  return addItemToCart(cart, makeLine()).cart
}

// ── Serialization ─────────────────────────────────────────────

test("serializeCart/deserializeCart round-trips a cart with money values", () => {
  const cart = buildCart()
  const restored = deserializeCart(serializeCart(cart))
  assert.deepEqual(restored, cart)
  assert.equal(restored!.items[0].unitPrice, 19.99)
  assert.equal(restored!.items[0].lineTotal, 39.98)
})

test("deserializeCart preserves archived flag and updatedAt", () => {
  const cart = createEmptyCart()
  const withArchived = addItemToCart(
    cart,
    makeItem({ productId: "p2", name: "Old", slug: "old", archived: true })
  ).cart
  const restored = deserializeCart(serializeCart(withArchived))
  assert.equal(restored!.items[0].archived, true)
  assert.equal(typeof restored!.updatedAt, "string")
  assert.notEqual(restored!.updatedAt, "")
})

test("deserializeCart returns null for missing payload", () => {
  assert.equal(deserializeCart(null), null)
  assert.equal(deserializeCart(""), null)
})

test("deserializeCart returns null for corrupt/foreign payload", () => {
  assert.equal(deserializeCart("not json"), null)
  assert.equal(deserializeCart("[]"), null)
  assert.equal(deserializeCart('{"items":"nope","updatedAt":"x"}'), null)
  assert.equal(deserializeCart('{"items":[],"updatedAt":123}'), null)
})

test("deserializeCart rejects a line missing required fields", () => {
  const bad = JSON.stringify({
    items: [{ productId: "p1", name: "x" }],
    updatedAt: "2026-01-01T00:00:00.000Z",
  })
  assert.equal(deserializeCart(bad), null)
})

// ── Key design ────────────────────────────────────────────────

test("cartKey is namespaced under cart: and isolates shoppers", () => {
  assert.equal(cartKey("user:abc"), `${CART_KEY_PREFIX}user:abc`)
  assert.equal(cartKey("anon:uuid"), `${CART_KEY_PREFIX}anon:uuid`)
  assert.notEqual(cartKey("user:abc"), cartKey("user:abd"))
  assert.notEqual(cartKey("user:abc"), cartKey("anon:abc"))
})

// ── RedisCartStore behavior ───────────────────────────────────

test("write/read round trip restores the cart", async () => {
  const fake = new FakeRedis()
  const store = new RedisCartStore(fake)
  const cart = buildCart()

  await store.saveCart("user:1", cart)
  const restored = await store.getCart("user:1")

  assert.deepEqual(restored, cart)
})

test("getCart returns null for a missing cart", async () => {
  const store = new RedisCartStore(new FakeRedis())
  assert.equal(await store.getCart("user:none"), null)
})

test("update existing cart overwrites the previous value", async () => {
  const fake = new FakeRedis()
  const store = new RedisCartStore(fake)
  const cart = buildCart()
  await store.saveCart("user:1", cart)

  const updated = addItemToCart(cart, makeItem({ productId: "p2", name: "Gadget", slug: "gadget", unitPrice: 5 }))
  await store.saveCart("user:1", updated.cart)

  const restored = await store.getCart("user:1")
  assert.equal(restored!.items.length, 2)
  assert.deepEqual(restored, updated.cart)
})

test("remove-item semantics: saving a cart without the line drops it", async () => {
  const fake = new FakeRedis()
  const store = new RedisCartStore(fake)
  const cart = addItemToCart(
    buildCart(),
    makeItem({ productId: "p2", name: "Gadget", slug: "gadget", unitPrice: 5 })
  ).cart
  await store.saveCart("user:1", cart)

  const afterRemove = removeCartItem(cart, "p1")
  await store.saveCart("user:1", afterRemove)

  const restored = await store.getCart("user:1")
  assert.equal(restored!.items.length, 1)
  assert.equal(restored!.items[0].productId, "p2")
})

test("deleteCart removes the cart", async () => {
  const fake = new FakeRedis()
  const store = new RedisCartStore(fake)
  await store.saveCart("user:1", buildCart())
  assert.notEqual(await store.getCart("user:1"), null)

  await store.deleteCart("user:1")
  assert.equal(await store.getCart("user:1"), null)
})

test("empty cart can be stored and read back", async () => {
  const store = new RedisCartStore(new FakeRedis())
  const empty = createEmptyCart()
  await store.saveCart("user:1", empty)
  const restored = await store.getCart("user:1")
  assert.deepEqual(restored, empty)
  assert.equal(restored!.items.length, 0)
})

test("TTL: saveCart writes with the 30-day expiry constant", async () => {
  const fake = new FakeRedis()
  const store = new RedisCartStore(fake)
  await store.saveCart("user:1", buildCart())
  assert.equal(fake.setCalls[0].ex, CART_TTL_SECONDS)
  assert.equal(CART_TTL_SECONDS, 60 * 60 * 24 * 30)
})

test("TTL is refreshed on every write (update re-applies ex)", async () => {
  const fake = new FakeRedis()
  const store = new RedisCartStore(fake)
  const cart = buildCart()
  await store.saveCart("user:1", cart)
  await store.saveCart("user:1", cart)
  assert.equal(fake.setCalls.length, 2)
  assert.equal(fake.setCalls[1].ex, CART_TTL_SECONDS)
})

test("shopper isolation: carts live under separate keys", async () => {
  const fake = new FakeRedis()
  const store = new RedisCartStore(fake)
  await store.saveCart("user:a", buildCart())
  await store.saveCart(
    "user:b",
    addItemToCart(createEmptyCart(), makeItem({ productId: "p9", name: "Other", slug: "other" })).cart
  )
  assert.notEqual(fake.store.get(cartKey("user:a")), fake.store.get(cartKey("user:b")))
  const a = await store.getCart("user:a")
  const b = await store.getCart("user:b")
  assert.equal(a!.items[0].productId, "p1")
  assert.equal(b!.items[0].productId, "p9")
})

test("Redis failure throws CartStoreError with a generic, credential-free message", async () => {
  const fake = new FakeRedis()
  fake.shouldFail = true
  const store = new RedisCartStore(fake)

  await assert.rejects(() => store.getCart("user:1"), (err: unknown) => {
    assert.ok(err instanceof CartStoreError)
    assert.ok(!String(err.message).includes("secret"))
    assert.ok(!String(err.message).includes("url="))
    assert.ok((err as CartStoreError).cause !== undefined)
    return true
  })
  await assert.rejects(() => store.saveCart("user:1", buildCart()), (err: unknown) => {
    assert.ok(err instanceof CartStoreError)
    assert.ok(!String(err.message).includes("secret"))
    return true
  })
  await assert.rejects(() => store.deleteCart("user:1"), (err: unknown) => {
    assert.ok(err instanceof CartStoreError)
    return true
  })
})

// ── Configuration detection ───────────────────────────────────

test("isRedisConfigured is true only when both credentials are present", () => {
  assert.equal(isRedisConfigured({}), false)
  assert.equal(isRedisConfigured({ UPSTASH_REDIS_REST_URL: "u" }), false)
  assert.equal(isRedisConfigured({ UPSTASH_REDIS_REST_TOKEN: "t" }), false)
  assert.equal(
    isRedisConfigured({ UPSTASH_REDIS_REST_URL: "u", UPSTASH_REDIS_REST_TOKEN: "t" }),
    true
  )
})

test("REDIS_CONFIGURED reflects the real process.env at import time", () => {
  assert.equal(typeof REDIS_CONFIGURED, "boolean")
})

// ── Store selection ───────────────────────────────────────────

test("selectCartStore uses RedisCartStore when credentials are present", () => {
  let receivedClient: unknown = null
  const sentinel = new MemoryCartStore()
  const selected = selectCartStore(
    { UPSTASH_REDIS_REST_URL: "https://example", UPSTASH_REDIS_REST_TOKEN: "tok" },
    "production",
    (client) => {
      receivedClient = client
      return sentinel
    }
  )
  assert.equal(selected, sentinel)
  assert.notEqual(receivedClient, null)
})

test("selectCartStore falls back to MemoryCartStore in dev without credentials", () => {
  const selected = selectCartStore({}, "development")
  assert.ok(selected instanceof MemoryCartStore)
})

test("selectCartStore falls back to MemoryCartStore when NODE_ENV is unset", () => {
  const selected = selectCartStore({}, undefined)
  assert.ok(selected instanceof MemoryCartStore)
})

test("selectCartStore throws CartConfigurationError in production without credentials", () => {
  assert.throws(
    () => selectCartStore({}, "production"),
    (err: unknown) => {
      assert.ok(err instanceof CartConfigurationError)
      assert.ok(String((err as Error).message).includes("UPSTASH_REDIS_REST_URL"))
      assert.ok(String((err as Error).message).includes("UPSTASH_REDIS_REST_TOKEN"))
      return true
    }
  )
})

test("selectCartStore prefers Redis over the dev fallback even in dev when configured", () => {
  const sentinel = new MemoryCartStore()
  const selected = selectCartStore(
    { UPSTASH_REDIS_REST_URL: "https://example.com", UPSTASH_REDIS_REST_TOKEN: "t" },
    "development",
    () => sentinel
  )
  assert.equal(selected, sentinel)
})

// ── Local helper (kept at bottom to avoid noise above) ────────

function makeItem(overrides: Partial<CartItemData> = {}): CartItemData {
  return {
    productId: "p1",
    name: "Widget",
    slug: "widget",
    imageUrl: null,
    unitPrice: 10,
    quantity: 1,
    ...overrides,
  }
}
