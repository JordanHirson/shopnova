import Link from "next/link"
import { ImageIcon } from "lucide-react"

import type { SearchHighlight } from "@/features/search/search-logic"

interface ProductCardProps {
  product: {
    id: string
    name: string
    slug: string
    price: { toString(): string }
    compareAtPrice: { toString(): string } | null
    category: { name: string; slug: string }
    images: { url: string; alt: string | null }[]
  }
  /** Optional search highlight tags explaining why the product matched. */
  highlights?: SearchHighlight[]
}

export function ProductCard({ product, highlights }: ProductCardProps) {
  const image = product.images[0]
  const compareAt = product.compareAtPrice
    ? Number(product.compareAtPrice)
    : null
  const currentPrice = Number(product.price.toString())
  const hasSale =
    compareAt !== null && !Number.isNaN(compareAt) && compareAt > currentPrice

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border bg-background transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.alt ?? product.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs font-medium text-muted-foreground">
          {product.category.name}
        </p>
        <h3 className="font-medium text-foreground line-clamp-1">
          {product.name}
        </h3>
        {highlights && highlights.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {highlights.map((highlight, index) => (
              <span
                key={`${highlight.field}-${index}`}
                className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              >
                {highlight.label}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <p className="text-sm font-semibold text-foreground">
            R {product.price.toString()}
          </p>
          {hasSale && (
            <p className="text-xs text-muted-foreground line-through">
              R {compareAt!.toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}