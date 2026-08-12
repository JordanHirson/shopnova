import Link from "next/link"
import { notFound } from "next/navigation"
import { Container } from "@/components/layout/container"
import { ProductCard } from "@/components/storefront/product-card"
import { getCategoryBySlug, listProductsByCategory } from "@/lib/db"

export const dynamic = "force-dynamic"

interface CategoryPageProps {
  params: Promise<{ slug: string }>
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)

  if (!category) {
    notFound()
  }

  const products = await listProductsByCategory(slug)

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mb-8">
          <Link
            href="/categories"
            className="text-sm font-medium text-primary hover:underline"
          >
            &larr; All Categories
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {category.description}
            </p>
          )}
        </div>
        {products.length === 0 ? (
          <div className="rounded-lg border p-12 text-center text-muted-foreground">
            <p>No products in this category yet.</p>
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