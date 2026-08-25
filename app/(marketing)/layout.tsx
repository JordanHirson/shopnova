import Link from "next/link"
import { Suspense } from "react"
import { Container } from "@/components/layout/container"
import { AccountButton } from "@/components/storefront/account-button"
import { AdminLink } from "@/components/storefront/admin-link"
import { CartButton } from "@/components/storefront/cart-button"
import { MobileNav } from "@/components/storefront/mobile-nav"
import { SearchBox } from "@/components/storefront/search-box"
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
          <Container className="flex min-w-0 h-14 items-center justify-between gap-4">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 font-semibold"
            >
              <Package className="h-5 w-5" />
              <span>ShopNova</span>
            </Link>
            <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
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
            </nav>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-1 md:flex-none md:gap-2">
              <MobileNav />
              <Suspense fallback={null}>
                <SearchBox />
              </Suspense>
              <CartButton />
              <AccountButton />
              <AdminLink />
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