import { notFound } from "next/navigation"
import { Container } from "@/components/layout/container"
import { EmptyState } from "@/components/layout/empty-state"
import { PageIntro } from "@/components/storefront/page-intro"
import { ProductGrid } from "@/components/storefront/product-grid"
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
        <PageIntro
          title={category.name}
          description={category.description ?? undefined}
          backLink={{ href: "/categories", label: "All Categories" }}
        />
        {products.length === 0 ? (
          <EmptyState message="No products in this category yet." />
        ) : (
          <ProductGrid products={products} />
        )}
      </Container>
    </div>
  )
}
