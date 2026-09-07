/**
 * ShopNova - Clears the client cart after a successful checkout.
 *
 * The verified-payment webhook already deletes the persisted cart
 * server-side, but the client CartContext is not aware of that until it
 * re-fetches. This component runs once on mount: it clears the persisted
 * cart (an idempotent safety net for webhook race conditions) and
 * refreshes the context so the header badge and cart page immediately
 * reflect the empty cart.
 */
"use client"

import { useEffect } from "react"

import { clearCartAction } from "@/features/cart/actions"
import { useCart } from "@/features/cart/cart-context"

export function CartClearOnSuccess() {
  const { refresh } = useCart()

  useEffect(() => {
    let active = true

    void (async () => {
      await clearCartAction()
      if (active) await refresh()
    })()

    return () => {
      active = false
    }
  }, [refresh])

  return null
}
