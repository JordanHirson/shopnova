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
import { getCartProduct, getCartProductStatuses } from "@/lib/db"
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

/**
 * Returns the current cart, or an empty cart when the cart store is
 * unavailable. Used for defensive read paths where a thrown store error
 * should degrade gracefully instead of surfacing the error boundary.
 */
async function getCartOrEmpty(): Promise<Cart> {
  try {
    return await getCartAction()
  } catch {
    return createEmptyCart()
  }
}

/** Returns the current cart for the active shopper. */
export async function getCartAction(): Promise<Cart> {
  const shopperId = await getShopperId()
  const cart = await loadCart(shopperId)
  const archivedByProduct = await getCartProductStatuses(
    cart.items.map((item) => item.productId)
  )
  return {
    ...cart,
    items: cart.items.map((item) => ({
      ...item,
      archived: archivedByProduct.get(item.productId) ?? item.archived ?? false,
    })),
  }
}

/** Adds a product to the cart. */
export async function addToCartAction(
  productId: string,
  quantity: number
): Promise<CartActionResult> {
  if (!productId) {
    return { cart: await getCartOrEmpty(), error: "Product is required.", shopperId: undefined }
  }

  const product = await getCartProduct(productId)
  if (!product) {
    return { cart: await getCartOrEmpty(), error: "Product not found.", shopperId: undefined }
  }

  let shopperId: string | undefined = undefined
  try {
    shopperId = await getShopperId()
  } catch (err) {
    return {
      cart: await getCartOrEmpty(),
      error:
        err instanceof Error ? err.message : "Failed to identify shopper.",
      shopperId,
    }
  }

  if (!shopperId) {
    return { cart: createEmptyCart(), error: "Failed to identify shopper.", shopperId: undefined }
  }

  let cart: Cart
  try {
    cart = await loadCart(shopperId)
  } catch (err) {
    return {
      cart: createEmptyCart(),
      error: err instanceof Error ? err.message : "Failed to load the cart.",
      shopperId,
    }
  }

  const result = addItemToCart(
    cart,
    {
      productId: product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: product.imageUrl,
      unitPrice: product.price,
      quantity,
      archived: product.archived,
    },
    product.quantityAvailable
  )

  try {
    await cartStore.saveCart(shopperId, result.cart)
    revalidatePath("/", "layout")
  } catch (err) {
    return {
      cart: result.cart,
      error:
        err instanceof Error
          ? err.message
          : "Failed to save the cart. Please try again.",
      shopperId,
    }
  }

  return { cart: result.cart, error: result.error, shopperId }
}

/** Sets the exact quantity of a cart line. */
export async function updateCartItemQuantityAction(
  productId: string,
  quantity: number
): Promise<CartActionResult> {
  if (!productId) {
    return { cart: await getCartOrEmpty(), error: "Product is required.", shopperId: undefined }
  }

  const product = await getCartProduct(productId)
  if (!product) {
    return { cart: await getCartOrEmpty(), error: "Product not found.", shopperId: undefined }
  }

  let shopperId: string | undefined = undefined
  try {
    shopperId = await getShopperId()
  } catch (err) {
    return {
      cart: await getCartOrEmpty(),
      error:
        err instanceof Error ? err.message : "Failed to identify shopper.",
      shopperId,
    }
  }

  if (!shopperId) {
    return { cart: createEmptyCart(), error: "Failed to identify shopper.", shopperId: undefined }
  }

  let cart: Cart
  try {
    cart = await loadCart(shopperId)
  } catch (err) {
    return {
      cart: createEmptyCart(),
      error: err instanceof Error ? err.message : "Failed to load the cart.",
      shopperId,
    }
  }

  const result = updateCartItemQuantity(
    cart,
    productId,
    quantity,
    product.quantityAvailable
  )

  try {
    await cartStore.saveCart(shopperId, result.cart)
    revalidatePath("/", "layout")
  } catch (err) {
    return {
      cart: result.cart,
      error:
        err instanceof Error
          ? err.message
          : "Failed to save the cart. Please try again.",
      shopperId,
    }
  }

  return { cart: result.cart, error: result.error, shopperId }
}

/** Removes a single line from the cart. */
export async function removeCartItemAction(
  productId: string
): Promise<CartActionResult> {
  if (!productId) {
    return { cart: await getCartOrEmpty(), error: "Product is required.", shopperId: undefined }
  }

  let shopperId: string | undefined = undefined
  try {
    shopperId = await getShopperId()
  } catch (err) {
    return {
      cart: await getCartOrEmpty(),
      error:
        err instanceof Error ? err.message : "Failed to identify shopper.",
      shopperId,
    }
  }

  if (!shopperId) {
    return { cart: createEmptyCart(), error: "Failed to identify shopper.", shopperId: undefined }
  }

  let cart: Cart
  try {
    cart = await loadCart(shopperId)
  } catch (err) {
    return {
      cart: createEmptyCart(),
      error: err instanceof Error ? err.message : "Failed to load the cart.",
      shopperId,
    }
  }

  const updated = removeCartItem(cart, productId)

  try {
    await cartStore.saveCart(shopperId, updated)
    revalidatePath("/", "layout")
  } catch (err) {
    return {
      cart: updated,
      error:
        err instanceof Error
          ? err.message
          : "Failed to save the cart. Please try again.",
      shopperId,
    }
  }

  return { cart: updated, shopperId }
}

/** Clears the entire cart. */
export async function clearCartAction(): Promise<CartActionResult> {
  let shopperId: string | undefined = undefined
  try {
    shopperId = await getShopperId()
  } catch (err) {
    return {
      cart: await getCartOrEmpty(),
      error:
        err instanceof Error ? err.message : "Failed to identify shopper.",
      shopperId,
    }
  }

  if (!shopperId) {
    return { cart: createEmptyCart(), error: "Failed to identify shopper.", shopperId: undefined }
  }

  const empty = clearCartLogic()

  try {
    await cartStore.saveCart(shopperId, empty)
    revalidatePath("/", "layout")
  } catch (err) {
    return {
      cart: empty,
      error:
        err instanceof Error
          ? err.message
          : "Failed to save the cart. Please try again.",
      shopperId,
    }
  }

  return { cart: empty, shopperId }
}