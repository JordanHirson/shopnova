/**
 * ShopNova - Cart page view (client component).
 *
 * Reads from the CartContext (backed by the server cart) and mutates
 * through server actions. Prices displayed here are the snapshot stored
 * in the cart; checkout re-reads authoritative prices from PostgreSQL.
 */
"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { ImageIcon, Loader2, Minus, Plus, Trash2 } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  clearCartAction,
  removeCartItemAction,
  updateCartItemQuantityAction,
} from "@/features/cart/actions"
import { useCart } from "@/features/cart/cart-context"
import { getCartSubtotal } from "@/features/cart/cart-logic"

export function CartView() {
  const { cart, loading, error, refresh } = useCart()
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)

  function runAction(action: () => Promise<void>) {
    setActionError(null)
    startTransition(async () => {
      await action()
      await refresh()
    })
  }

  function handleSetQuantity(productId: string, quantity: number) {
    runAction(async () => {
      const result = await updateCartItemQuantityAction(productId, quantity)
      if (result.error) setActionError(result.error)
    })
  }

  function handleRemove(productId: string) {
    runAction(async () => {
      await removeCartItemAction(productId)
    })
  }

  function handleClear() {
    runAction(async () => {
      await clearCartAction()
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border py-16 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Your cart is empty
        </h2>
        <p className="text-sm text-muted-foreground">
          Browse the store to find something{" "}
          you will love.
        </p>
        <Link
          href="/products"
          className={buttonVariants({ size: "lg" })}
        >
          Continue Shopping
        </Link>
      </div>
    )
  }

  const subtotal = getCartSubtotal(cart)

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      {/* Cart lines */}
      <div className="flex flex-col gap-4">
        {cart.items.map((item) => (
          <div
            key={item.productId}
            className="flex gap-4 rounded-lg border p-4"
          >
            <Link
              href={`/products/${item.slug}`}
              className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border bg-muted"
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                </div>
              )}
            </Link>

            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/products/${item.slug}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    ${item.unitPrice.toFixed(2)} each
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${item.name} from cart`}
                  onClick={() => handleRemove(item.productId)}
                  disabled={isPending}
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Decrease quantity"
                    disabled={item.quantity <= 1 || isPending}
                    onClick={() =>
                      handleSetQuantity(item.productId, item.quantity - 1)
                    }
                  >
                    <Minus />
                  </Button>
                  <span
                    className="w-10 text-center text-sm font-medium tabular-nums"
                    aria-live="polite"
                  >
                    {item.quantity}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Increase quantity"
                    disabled={isPending}
                    onClick={() =>
                      handleSetQuantity(item.productId, item.quantity + 1)
                    }
                  >
                    <Plus />
                  </Button>
                </div>
                <p className="font-semibold text-foreground">
                  ${item.lineTotal.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="h-fit rounded-lg border p-6 lg:sticky lg:top-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Order Summary
        </h2>
        <div className="flex justify-between border-b pb-4 text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold text-foreground">
            ${subtotal.toFixed(2)}
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <Button size="lg" type="button" disabled>
            Proceed to Checkout
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Checkout will be available in the next sprint.
          </p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleClear}
            disabled={isPending}
          >
            Clear Cart
          </Button>
        </div>
        {actionError && (
          <p className="mt-3 text-sm font-medium text-destructive">
            {actionError}
          </p>
        )}
        <Link
          href="/products"
          className="mt-4 block text-center text-sm font-medium text-primary hover:underline"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  )
}