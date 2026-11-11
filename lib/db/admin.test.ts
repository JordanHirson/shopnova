/**
 * ShopNova - Admin order-status database tests.
 *
 * Run with: node --test --experimental-strip-types lib/db/admin.test.ts
 *
 * `updateOrderStatusTx` is unit-tested against a fake Prisma client (no
 * database). Covers:
 *   - cancelling restores each item's quantity to inventory, exactly once,
 *     in the same transaction as the status change
 *   - cancelling twice is blocked (CANCELLED is final), so stock is never
 *     restocked twice
 *   - non-cancelling transitions never touch inventory
 *   - blocked transitions throw before any write
 *   - a missing order throws before any write
 */
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  type LoadedOrder,
  type OrderInventoryClient,
  updateOrderStatusTx,
} from "./admin.ts"
import type { Prisma } from "@prisma/client"

function anOrder(
  status: string,
  items: Array<{
    productId: string
    quantity: number
    inventoryQuantity: number | null
  }>
): LoadedOrder {
  return {
    orderNumber: "WEB-1001",
    status,
    items: items.map((item) => ({
      quantity: item.quantity,
      productId: item.productId,
      product: {
        id: item.productId,
        inventory:
          item.inventoryQuantity === null
            ? null
            : { id: `inv-${item.productId}`, quantity: item.inventoryQuantity },
      },
    })),
  }
}

/** Fake Prisma client recording every write, scoped to one order in memory. */
function makeClient(initial: LoadedOrder) {
  let status = initial.status
  const restocks: string[] = []
  const updates: string[] = []
  let transactionRuns = 0

    const client: OrderInventoryClient = {
    order: {
      findFirst: async () => ({
        ...initial,
        status,
      }),
      update: async (args: Prisma.OrderUpdateArgs): Promise<unknown> => {
        status = String((args.data as { status?: string })?.status ?? status)
        updates.push(status)
        return {}
      },
    },
    inventory: {
      update: async (args: Prisma.InventoryUpdateArgs): Promise<unknown> => {
        restocks.push(String((args.where as { productId?: string })?.productId))
        return {}
      },
    },
    $transaction: async <T>(fn: (tx: OrderInventoryClient) => Promise<T>) => {
      transactionRuns += 1
      return fn(client)
    },
  }

  return {
    client,
    restocks,
    updates,
    get transactionRuns() {
      return transactionRuns
    },
  }
}

test("cancelling a confirmed order restocks every item once, in the transaction", async () => {
  const order = anOrder("CONFIRMED", [
    { productId: "p-1", quantity: 2, inventoryQuantity: 5 },
    { productId: "p-2", quantity: 1, inventoryQuantity: 0 },
  ])
  const handle = makeClient(order)
  const { client, restocks, updates } = handle

  const updated = await updateOrderStatusTx(
    client,
    "store-1",
    "WEB-1001",
    "CANCELLED"
  )

  assert.deepEqual(updated, {}) // the fake's order.update return value
  assert.equal(handle.transactionRuns, 1) // status change + restock in ONE transaction
  assert.deepEqual(updates, ["CANCELLED"])
  assert.deepEqual(restocks, ["p-1", "p-2"]) // exactly once per item
})

test("cancelling twice is blocked and restocks only once", async () => {
  const order = anOrder("CONFIRMED", [
    { productId: "p-1", quantity: 3, inventoryQuantity: 4 },
  ])
  const { client, restocks, updates } = makeClient(order)

  await updateOrderStatusTx(client, "store-1", "WEB-1001", "CANCELLED")
  assert.deepEqual(updates, ["CANCELLED"])
  assert.deepEqual(restocks, ["p-1"])

  // The order is now CANCELLED — a second cancel is a blocked transition.
  await assert.rejects(
    updateOrderStatusTx(client, "store-1", "WEB-1001", "CANCELLED"),
    /Cannot transition/
  )
  assert.deepEqual(updates, ["CANCELLED"]) // no second status write
  assert.deepEqual(restocks, ["p-1"]) // stock returned exactly once
})

test("non-cancelling transitions never touch inventory", async () => {
  for (const [from, to] of [
    ["CONFIRMED", "PROCESSING"],
    ["PROCESSING", "SHIPPED"],
    ["SHIPPED", "DELIVERED"],
  ] as const) {
    const order = anOrder(from, [
      { productId: "p-1", quantity: 2, inventoryQuantity: 5 },
    ])
    const { client, restocks, updates } = makeClient(order)

    await updateOrderStatusTx(client, "store-1", "WEB-1001", to)

    assert.deepEqual(updates, [to])
    assert.deepEqual(restocks, [])
  }
})

test("blocked transitions throw before any write", async () => {
  const order = anOrder("CONFIRMED", [
    { productId: "p-1", quantity: 2, inventoryQuantity: 5 },
  ])
  const { client, restocks, updates } = makeClient(order)

  await assert.rejects(
    updateOrderStatusTx(client, "store-1", "WEB-1001", "DELIVERED"),
    /Cannot transition/
  )
  assert.deepEqual(updates, [])
  assert.deepEqual(restocks, [])
})

test("cancelling an order whose items have no inventory skips them", async () => {
  const order = anOrder("PROCESSING", [
    { productId: "p-1", quantity: 2, inventoryQuantity: null },
    { productId: "p-2", quantity: 1, inventoryQuantity: 10 },
  ])
  const { client, restocks } = makeClient(order)

  await updateOrderStatusTx(client, "store-1", "WEB-1001", "CANCELLED")

  assert.deepEqual(restocks, ["p-2"]) // only items with inventory are restocked
})

test("a missing order throws before any write", async () => {
  const { client, restocks, updates } = makeClient(
    anOrder("CONFIRMED", [])
  )
  // Pretend the order does not exist.
  client.order.findFirst = async () => null

  await assert.rejects(
    updateOrderStatusTx(client, "store-1", "WEB-9999", "CANCELLED"),
    /Order not found/
  )
  assert.deepEqual(updates, [])
  assert.deepEqual(restocks, [])
})
