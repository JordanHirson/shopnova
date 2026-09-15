import Link from "next/link"
import { Container } from "@/components/layout/container"
import { ProductCard } from "@/components/storefront/product-card"
import { buttonVariants } from "@/components/ui/button"
import { listFeaturedProducts, listCategories } from "@/lib/db"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const [featuredProducts, categories] = await Promise.all([
    listFeaturedProducts(8),
    listCategories(),
  ])

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-accent/5 to-background" />
        <div
          className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: "var(--accent)" }}
          aria-hidden
        />
        <Container className="relative flex flex-col items-center gap-6 py-20 text-center sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "var(--accent)" }}
              aria-hidden
            />
            New arrivals every week
          </span>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Discover products you will love
          </h1>
          <p className="max-w-md text-lg text-muted-foreground">
            Shop our curated collection of quality products at great prices.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/products"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Shop All Products
            </Link>
            <Link
              href="/categories"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Browse Categories
            </Link>
          </div>
        </Container>
      </section>

      {/* Featured categories */}
      {categories.length > 0 && (
        <section className="py-12 sm:py-16">
          <Container>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Shop by Category
              </h2>
              <Link
                href="/categories"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className="group relative flex flex-col gap-1 overflow-hidden rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30"
                >
                  <span
                    className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                    style={{ backgroundColor: "var(--accent)" }}
                    aria-hidden
                  />
                  <h3 className="font-medium text-foreground group-hover:text-primary">
                    {category.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {category._count.products}{" "}
                    {category._count.products === 1 ? "product" : "products"}
                  </p>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* Featured products */}
      {featuredProducts.length > 0 && (
        <section className="py-12 sm:py-16">
          <Container>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Featured Products
              </h2>
              <Link
                href="/products"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </Container>
        </section>
      )}
    </div>
  )
}