import type { Metadata } from "next"
import { Container } from "@/components/layout/container"
import { CartView } from "@/components/storefront/cart-view"

export const metadata: Metadata = {
  title: "Cart - ShopNova",
  description: "Review the items in your cart.",
}

export const dynamic = "force-dynamic"

export default function CartPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container>
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-foreground">
          Your Cart
        </h1>
        <CartView />
      </Container>
    </div>
  )
}