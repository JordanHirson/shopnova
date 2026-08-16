import { Container } from "@/components/layout/container"
import { EmptyState } from "@/components/layout/empty-state"
import { CategoryCard } from "@/components/storefront/category-card"
import { PageIntro } from "@/components/storefront/page-intro"
import { listCategories } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
  const categories = await listCategories()

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <PageIntro
          title="Categories"
          description="Browse products by category."
        />
        {categories.length === 0 ? (
          <EmptyState message="No categories available yet. Check back soon." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                showDescription
                className="p-6"
              />
            ))}
          </div>
        )}
      </Container>
    </div>
  )
}
