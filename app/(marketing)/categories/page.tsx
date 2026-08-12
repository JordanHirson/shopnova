import Link from "next/link"
import { Container } from "@/components/layout/container"
import { listCategories } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
  const categories = await listCategories()

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Categories
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse products by category.
          </p>
        </div>
        {categories.length === 0 ? (
          <div className="rounded-lg border p-12 text-center text-muted-foreground">
            <p>No categories available yet. Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="group flex flex-col gap-1 rounded-lg border bg-background p-6 transition-shadow hover:shadow-md"
              >
                <h2 className="font-semibold text-foreground group-hover:text-primary">
                  {category.name}
                </h2>
                {category.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {category.description}
                  </p>
                )}
                <p className="mt-auto pt-2 text-sm font-medium text-muted-foreground">
                  {category._count.products}{" "}
                  {category._count.products === 1 ? "product" : "products"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </div>
  )
}