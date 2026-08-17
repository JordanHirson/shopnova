/**
 * ShopNova - Header cart link with live item count.
 */
"use client"

import Link from "next/link"
import { ShoppingCart } from "lucide-react"

import { useCart } from "@/features/cart/cart-context"

export function CartButton() {
  const { itemCount, loading } = useCart()

  return (
    <Link
      href="/cart"
      className="relative inline-flex items-center gap-1.5 rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
      aria-label={`Go to cart (${itemCount} item${itemCount === 1 ? "" : "s"})`}
    >
      <ShoppingCart className="h-5 w-5" />
      {!loading && itemCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {itemCount}
        </span>
      )}
    </Link>
  )
}