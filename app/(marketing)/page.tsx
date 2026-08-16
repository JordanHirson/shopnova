import Link from "next/link"
import { Container } from "@/components/layout/container"
import { CategoryCard } from "@/components/storefront/category-card"
import { ProductGrid } from "@/components/storefront/product-grid"
import { SectionHeading } from "@/components/storefront/section-heading"
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
      <section className="border-b bg-gradient-to-b from-primary/5 to-background">
        <Container className="flex flex-col items-center gap-6 py-20 text-center sm:py-28">
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
            <SectionHeading
              title="Shop by Category"
              link={{ href: "/categories", label: "View all" }}
            />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* Featured products */}
      {featuredProducts.length > 0 && (
        <section className="py-12 sm:py-16">
          <Container>
            <SectionHeading
              title="Featured Products"
              link={{ href: "/products", label: "View all" }}
            />
            <ProductGrid
              products={featuredProducts}
              className="lg:grid-cols-4"
            />
          </Container>
        </section>
      )}
    </div>
  )
}
