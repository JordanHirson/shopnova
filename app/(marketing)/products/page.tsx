import { Container } from "@/components/layout/container"
import { ProductCard } from "@/components/storefront/product-card"
import { listStorefrontProducts } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function ProductsPage() {
  const products = await listStorefrontProducts()

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            All Products
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse our full collection of products.
          </p>
        </div>
        {products.length === 0 ? (
          <div className="rounded-lg border p-12 text-center text-muted-foreground">
            <p>No products available yet. Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </Container>
    </div>
  )
}