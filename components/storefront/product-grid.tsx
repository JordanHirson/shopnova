import { ProductCard } from "@/components/storefront/product-card"
import { cn } from "@/lib/utils"

type GridProduct = React.ComponentProps<typeof ProductCard>["product"]

interface ProductGridProps {
  products: GridProduct[]
  className?: string
}

/**
 * Responsive grid of product cards used across the storefront.
 */
export function ProductGrid({ products, className }: ProductGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className
      )}
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
