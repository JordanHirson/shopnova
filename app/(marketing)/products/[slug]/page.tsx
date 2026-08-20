import Link from "next/link"
import { notFound } from "next/navigation"
import { ImageIcon } from "lucide-react"
import { Container } from "@/components/layout/container"
import { AddToCartButton } from "@/components/storefront/add-to-cart-button"
import { getProductBySlug, getCartProduct } from "@/lib/db"

export const dynamic = "force-dynamic"

interface ProductDetailsPageProps {
  params: Promise<{ slug: string }>
}

export default async function ProductDetailsPage({
  params,
}: ProductDetailsPageProps) {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) {
    notFound()
  }

  // Current authoritative price + available inventory for add-to-cart.
  const cartProduct = await getCartProduct(product.id)
  const availableQuantity = cartProduct?.quantityAvailable ?? 0
  const displayPrice = cartProduct?.price ?? Number(product.price)

  const image = product.images[0]

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mb-8">
          <Link
            href="/products"
            className="text-sm font-medium text-primary hover:underline"
          >
            &larr; All Products
          </Link>
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Product image */}
          <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.url}
                alt={image.alt ?? product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-16 w-16 text-muted-foreground/40" />
              </div>
            )}
          </div>

          {/* Product details */}
          <div className="flex flex-col gap-4">
            <Link
              href={`/categories/${product.category.slug}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {product.category.name}
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {product.name}
            </h1>
            <p className="text-2xl font-semibold text-foreground">
              R {displayPrice.toFixed(2)}
            </p>
            {product.description && (
              <p className="text-muted-foreground whitespace-pre-line">
                {product.description}
              </p>
            )}
            <dl className="flex flex-col gap-2 border-t pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="text-right font-medium text-foreground">
                  <Link
                    href={`/categories/${product.category.slug}`}
                    className="hover:underline"
                  >
                    {product.category.name}
                  </Link>
                </dd>
              </div>
              {product.sku && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">SKU</dt>
                  <dd className="font-medium text-foreground">{product.sku}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Availability</dt>
                <dd
                  className={
                    availableQuantity > 0
                      ? "font-medium text-foreground"
                      : "font-medium text-destructive"
                  }
                >
                  {availableQuantity > 0
                    ? `In stock (${availableQuantity} available)`
                    : "Out of stock"}
                </dd>
              </div>
            </dl>
            <div className="mt-2">
              <AddToCartButton
                productId={product.id}
                quantity={1}
                maxQuantity={availableQuantity}
              />
            </div>
          </div>
        </div>
      </Container>
    </div>
  )
}