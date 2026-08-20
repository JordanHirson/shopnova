import Link from "next/link"
import { ImageIcon } from "lucide-react"

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
  const image = product.images[0]

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
        <p className="mt-auto pt-2 text-sm font-semibold text-foreground">
          R {product.price.toString()}
        </p>
      </div>
    </Link>
  )
}