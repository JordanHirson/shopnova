/**
 * ShopNova - Cart business logic unit tests.
 *
 * Run with: node --test --experimental-strip-types features/cart/cart-logic.test.ts
 *
 * The guidebook identifies cart calculations as a critical test area.
 */
import { test } from "node:test"
import assert from "node:assert/strict"

import type { CartItemData } from "../../types/cart"
import {
  addItemToCart,
  calculateLineTotal,
  clearCart,
  createEmptyCart,
  getCartItemCount,
  getCartSubtotal,
  removeCartItem,
  updateCartItemQuantity,
} from "./cart-logic.ts"

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

test("empty cart subtotal is 0", () => {
  const cart = createEmptyCart()
  assert.equal(getCartSubtotal(cart), 0)
  assert.equal(getCartItemCount(cart), 0)
})

test("adding an item creates a line", () => {
  const cart = createEmptyCart()
  const result = addItemToCart(cart, makeItem())
  assert.equal(result.cart.items.length, 1)
  assert.equal(result.cart.items[0].productId, "p1")
  assert.equal(result.cart.items[0].quantity, 1)
  assert.equal(result.cart.items[0].lineTotal, 10)
})

test("adding the same item increases quantity, not a duplicate line", () => {
  let cart = createEmptyCart()
  cart = addItemToCart(cart, makeItem()).cart
  const result = addItemToCart(cart, makeItem())
  assert.equal(result.cart.items.length, 1)
  assert.equal(result.cart.items[0].quantity, 2)
  assert.equal(result.cart.items[0].lineTotal, 20)
})

test("multiple products create separate lines", () => {
  let cart = createEmptyCart()
  cart = addItemToCart(cart, makeItem()).cart
  cart = addItemToCart(cart, makeItem({ productId: "p2", name: "Gadget", slug: "gadget", unitPrice: 5 })).cart
  assert.equal(cart.items.length, 2)
  assert.equal(getCartItemCount(cart), 2)
  assert.equal(getCartSubtotal(cart), 15)
})

test("quantity change updates line total and subtotal", () => {
  let cart = createEmptyCart()
  cart = addItemToCart(cart, makeItem()).cart
  const result = updateCartItemQuantity(cart, "p1", 3)
  assert.equal(result.cart.items[0].quantity, 3)
  assert.equal(result.cart.items[0].lineTotal, 30)
  assert.equal(getCartSubtotal(result.cart), 30)
})

test("removing an item removes the line", () => {
  let cart = createEmptyCart()
  cart = addItemToCart(cart, makeItem()).cart
  cart = addItemToCart(cart, makeItem({ productId: "p2", name: "Gadget", slug: "gadget", unitPrice: 5 })).cart
  const updated = removeCartItem(cart, "p1")
  assert.equal(updated.items.length, 1)
  assert.equal(updated.items[0].productId, "p2")
})

test("clearing the cart empties it", () => {
  const cart = addItemToCart(createEmptyCart(), makeItem()).cart
  assert.equal(cart.items.length, 1)
  const cleared = clearCart()
  assert.equal(cleared.items.length, 0)
  assert.equal(getCartSubtotal(cleared), 0)
})

test("item count sums quantities", () => {
  let cart = createEmptyCart()
  cart = addItemToCart(cart, makeItem({ quantity: 2 })).cart
  cart = addItemToCart(cart, makeItem({ productId: "p2", name: "Gadget", slug: "gadget", unitPrice: 5, quantity: 3 })).cart
  assert.equal(getCartItemCount(cart), 5)
})

test("subtotal sums line totals", () => {
  let cart = createEmptyCart()
  cart = addItemToCart(cart, makeItem({ quantity: 2 })).cart
  cart = addItemToCart(cart, makeItem({ productId: "p2", name: "Gadget", slug: "gadget", unitPrice: 5, quantity: 3 })).cart
  assert.equal(getCartSubtotal(cart), 35)
})

test("quantity cannot become zero or negative", () => {
  let cart = createEmptyCart()
  cart = addItemToCart(cart, makeItem()).cart
  const result = updateCartItemQuantity(cart, "p1", 0)
  assert.equal(result.cart.items.length, 0)
  assert.ok(result.error)
})

test("quantity is capped by available inventory", () => {
  const cart = createEmptyCart()
  const result = addItemToCart(cart, makeItem({ quantity: 5 }), 3)
  assert.equal(result.cart.items[0].quantity, 3)
  assert.ok(result.error)
})

test("adding beyond inventory caps the existing line", () => {
  let cart = createEmptyCart()
  cart = addItemToCart(cart, makeItem({ quantity: 2 }), 5).cart
  const result = addItemToCart(cart, makeItem({ quantity: 4 }), 5)
  assert.equal(result.cart.items[0].quantity, 5)
  assert.ok(result.error)
})

test("out of stock item is rejected", () => {
  const cart = createEmptyCart()
  const result = addItemToCart(cart, makeItem(), 0)
  assert.equal(result.cart.items.length, 0)
  assert.ok(result.error)
})

test("line total uses cents math to avoid float drift", () => {
  assert.equal(calculateLineTotal(0.1, 3), 0.3)
  assert.equal(calculateLineTotal(19.99, 3), 59.97)
})