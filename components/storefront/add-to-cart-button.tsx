/**
 * ShopNova - Add to Cart button (client component).
 *
 * Calls the server action `addToCartAction` so the client never sends
 * prices or stock - the server re-reads authoritative product data from
 * PostgreSQL before mutating the cart.
 */
"use client"

import { useState, useTransition } from "react"
import { Loader2, Minus, Plus, ShoppingCart } from "lucide-react"

import { Button } from "@/components/ui/button"
import { addToCartAction } from "@/features/cart/actions"
import { useCart } from "@/features/cart/cart-context"

interface AddToCartButtonProps {
  productId: string
  quantity?: number
  /** Available inventory; disables the button and caps the selector. */
  maxQuantity?: number
}

export function AddToCartButton({
  productId,
  quantity = 1,
  maxQuantity,
}: AddToCartButtonProps) {
  const [selectedQuantity, setSelectedQuantity] = useState(quantity)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { refresh } = useCart()

  const outOfStock = maxQuantity !== undefined && maxQuantity < 1
  const canIncrease =
    maxQuantity === undefined || selectedQuantity < maxQuantity

  function handleClick() {
    setMessage(null)
    startTransition(async () => {
      const result = await addToCartAction(productId, selectedQuantity)

      if (result.error) {
        setMessage(result.error)
        return
      }

      setMessage("Added to cart.")
      await refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {maxQuantity !== undefined && maxQuantity > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Quantity</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Decrease quantity"
              disabled={selectedQuantity <= 1 || isPending}
              onClick={() => setSelectedQuantity((q) => Math.max(1, q - 1))}
            >
              <Minus />
            </Button>
            <span
              className="w-10 text-center text-sm font-medium tabular-nums"
              aria-live="polite"
            >
              {selectedQuantity}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Increase quantity"
              disabled={!canIncrease || isPending}
              onClick={() => setSelectedQuantity((q) => q + 1)}
            >
              <Plus />
            </Button>
          </div>
          {maxQuantity !== undefined && (
            <span className="text-xs text-muted-foreground">
              {maxQuantity} available
            </span>
          )}
        </div>
      )}

      <Button
        size="lg"
        type="button"
        onClick={handleClick}
        disabled={isPending || outOfStock}
      >
        {isPending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <ShoppingCart />
        )}
        {isPending
          ? "Adding..."
          : outOfStock
            ? "Out of Stock"
            : "Add to Cart"}
      </Button>
      {message && (
        <p
          className={
            message === "Added to cart."
              ? "text-sm font-medium text-green-600"
              : "text-sm font-medium text-destructive"
          }
        >
          {message}
        </p>
      )}
    </div>
  )
}