import { Container } from "@/components/layout/container"
import { EmptyState } from "@/components/layout/empty-state"
import { PageIntro } from "@/components/storefront/page-intro"
import { ProductGrid } from "@/components/storefront/product-grid"
import { listStorefrontProducts } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function ProductsPage() {
  const products = await listStorefrontProducts()

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <PageIntro
          title="All Products"
          description="Browse our full collection of products."
        />
        {products.length === 0 ? (
          <EmptyState message="No products available yet. Check back soon." />
        ) : (
          <ProductGrid products={products} />
        )}
      </Container>
    </div>
  )
}
