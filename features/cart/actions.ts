/**
 * ShopNova - Cart server actions.
 *
 * All cart mutations run on the server:
 *   1. Resolve the shopper id (Clerk user or anonymous cookie).
 *   2. Load the persisted cart from the cart store.
 *   3. Apply pure cart business logic.
 *   4. Persist back to the cart store.
 *
 * PRICE RULE:
 * The client only sends productId + quantity. Prices and inventory are
 * always re-read from PostgreSQL before modifying the cart.
 */
"use server"

import { revalidatePath } from "next/cache"
import { getCartProduct } from "@/lib/db"
import type {
  Cart,
  CartActionResult,
} from "@/types/cart"
import {
  addItemToCart,
  clearCart as clearCartLogic,
  createEmptyCart,
  removeCartItem,
  updateCartItemQuantity,
} from "./cart-logic"
import { cartStore } from "./cart-store"
import { getShopperId } from "./session"

async function loadCart(shopperId: string): Promise<Cart> {
  const existing = await cartStore.getCart(shopperId)
  return existing ?? createEmptyCart()
}

/** Returns the current cart for the active shopper. */
export async function getCartAction(): Promise<Cart> {
  const shopperId = await getShopperId()
  const cart = await loadCart(shopperId)
  return cart
}

/** Adds a product to the cart. */
export async function addToCartAction(
  productId: string,
  quantity: number
): Promise<CartActionResult> {
  if (!productId) {
    return { cart: await getCartAction(), error: "Product is required." }
  }

  const product = await getCartProduct(productId)
  if (!product) {
    return { cart: await getCartAction(), error: "Product not found." }
  }

  const shopperId = await getShopperId()
  const cart = await loadCart(shopperId)

  const result = addItemToCart(
    cart,
    {
      productId: product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: product.imageUrl,
      unitPrice: product.price,
      quantity,
    },
    product.quantityAvailable
  )

  await cartStore.saveCart(shopperId, result.cart)
  revalidatePath("/", "layout")

  return { cart: result.cart, error: result.error }
}

/** Sets the exact quantity of a cart line. */
export async function updateCartItemQuantityAction(
  productId: string,
  quantity: number
): Promise<CartActionResult> {
  if (!productId) {
    return { cart: await getCartAction(), error: "Product is required." }
  }

  const product = await getCartProduct(productId)
  if (!product) {
    return { cart: await getCartAction(), error: "Product not found." }
  }

  const shopperId = await getShopperId()
  const cart = await loadCart(shopperId)

  const result = updateCartItemQuantity(
    cart,
    productId,
    quantity,
    product.quantityAvailable
  )

  await cartStore.saveCart(shopperId, result.cart)
  revalidatePath("/", "layout")

  return { cart: result.cart, error: result.error }
}

/** Removes a single line from the cart. */
export async function removeCartItemAction(
  productId: string
): Promise<CartActionResult> {
  if (!productId) {
    return { cart: await getCartAction(), error: "Product is required." }
  }

  const shopperId = await getShopperId()
  const cart = await loadCart(shopperId)

  const updated = removeCartItem(cart, productId)
  await cartStore.saveCart(shopperId, updated)
  revalidatePath("/", "layout")

  return { cart: updated }
}

/** Clears the entire cart. */
export async function clearCartAction(): Promise<CartActionResult> {
  const shopperId = await getShopperId()
  const empty = clearCartLogic()
  await cartStore.saveCart(shopperId, empty)
  revalidatePath("/", "layout")

  return { cart: empty }
}