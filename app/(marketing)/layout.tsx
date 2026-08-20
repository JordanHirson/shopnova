import Link from "next/link"
import { Container } from "@/components/layout/container"
import { AccountButton } from "@/components/storefront/account-button"
import { CartButton } from "@/components/storefront/cart-button"
import { CartProvider } from "@/features/cart/cart-context"
import { Package } from "lucide-react"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col">
        <header className="border-b">
          <Container className="flex h-14 items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Package className="h-5 w-5" />
              <span>ShopNova</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium">
              <Link
                href="/"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Home
              </Link>
              <Link
                href="/products"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Products
              </Link>
              <Link
                href="/categories"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Categories
              </Link>
              <Link
                href="/about"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                About
              </Link>
              <Link
                href="/pricing"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Pricing
              </Link>
              <Link
                href="/contact"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Contact
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              <CartButton />
              <AccountButton />
            </div>
          </Container>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t py-6">
          <Container className="text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} ShopNova. All rights reserved.
          </Container>
        </footer>
      </div>
    </CartProvider>
  )
}