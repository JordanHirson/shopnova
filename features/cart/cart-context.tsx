/**
 * ShopNova - Client cart context.
 *
 * Provides the server-side cart to client components (header badge,
 * product page, cart page). All mutations still run through server
 * actions; this context is only a read/refresh bridge so the UI stays
 * in sync without turning the marketing layout into a client component.
 */
"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type { Cart } from "@/types/cart"
import { getCartAction } from "./actions"

interface CartContextValue {
  cart: Cart
  loading: boolean
  error: string | null
  itemCount: number
  refresh: () => Promise<void>
}

const EMPTY_CART: Cart = { items: [], updatedAt: "" }
const EMPTY_ITEM_COUNT = 0

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(EMPTY_CART)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initial server-side cart load. setState only runs after the await,
  // so the effect never triggers a synchronous cascading render.
  useEffect(() => {
    let active = true

    async function load() {
      try {
        const next = await getCartAction()
        if (active) {
          setCart(next)
          setError(null)
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Failed to load the cart."
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  // Manual refresh after a cart mutation. Called from user events
  // (buttons/forms), never from an effect.
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await getCartAction()
      setCart(next)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load the cart."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const itemCount = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.quantity, EMPTY_ITEM_COUNT),
    [cart]
  )

  return (
    <CartContext.Provider value={{ cart, loading, error, itemCount, refresh }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider.")
  }
  return ctx
}