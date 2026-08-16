import Link from "next/link"

import { cn, pluralize } from "@/lib/utils"

interface CategoryCardProps {
  category: {
    id: string
    name: string
    slug: string
    description?: string | null
    _count: { products: number }
  }
  showDescription?: boolean
  className?: string
}

/**
 * Link card showing a category name, optional description and product count.
 */
export function CategoryCard({
  category,
  showDescription = false,
  className,
}: CategoryCardProps) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className={cn(
        "group flex flex-col gap-1 rounded-lg border bg-background p-5 transition-shadow hover:shadow-md",
        className
      )}
    >
      <h3 className="font-medium text-foreground group-hover:text-primary">
        {category.name}
      </h3>
      {showDescription && category.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {category.description}
        </p>
      )}
      <p className="mt-auto pt-2 text-sm text-muted-foreground">
        {pluralize(category._count.products, "product")}
      </p>
    </Link>
  )
}
