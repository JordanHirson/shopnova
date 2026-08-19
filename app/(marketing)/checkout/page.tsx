import type { Metadata } from "next"
import { Container } from "@/components/layout/container"
import { CheckoutView } from "@/components/storefront/checkout-view"

export const metadata: Metadata = {
  title: "Checkout - ShopNova",
  description: "Complete your order.",
}

export const dynamic = "force-dynamic"

export default function CheckoutPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container>
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-foreground">
          Checkout
        </h1>
        <CheckoutView />
      </Container>
    </div>
  )
}