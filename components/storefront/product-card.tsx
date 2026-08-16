import Link from "next/link"

import { ProductImage } from "@/components/storefront/product-image"
import { formatPrice } from "@/lib/utils"

interface ProductCardProps {
  product: {
    id: string
    name: string
    slug: string
    price: { toString(): string }
    category: { name: string; slug: string }
    images: { url: string; alt: string | null }[]
  }
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border bg-background transition-shadow hover:shadow-md"
    >
      <ProductImage
        image={product.images[0]}
        name={product.name}
        imageClassName="transition-transform group-hover:scale-105"
      />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs font-medium text-muted-foreground">
          {product.category.name}
        </p>
        <h3 className="font-medium text-foreground line-clamp-1">
          {product.name}
        </h3>
        <p className="mt-auto pt-2 text-sm font-semibold text-foreground">
          {formatPrice(product.price)}
        </p>
      </div>
    </Link>
  )
}
