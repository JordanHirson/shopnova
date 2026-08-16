import Link from "next/link"
import { notFound } from "next/navigation"
import { Container } from "@/components/layout/container"
import { ProductImage } from "@/components/storefront/product-image"
import { TextLink } from "@/components/storefront/text-link"
import { Button } from "@/components/ui/button"
import { getProductBySlug } from "@/lib/db"
import { formatPrice } from "@/lib/utils"

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

  const categoryHref = `/categories/${product.category.slug}`

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mb-8">
          <TextLink href="/products">&larr; All Products</TextLink>
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Product image */}
          <ProductImage
            image={product.images[0]}
            name={product.name}
            className="rounded-lg border"
            iconClassName="h-16 w-16"
          />

          {/* Product details */}
          <div className="flex flex-col gap-4">
            <TextLink href={categoryHref}>{product.category.name}</TextLink>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {product.name}
            </h1>
            <p className="text-2xl font-semibold text-foreground">
              {formatPrice(product.price)}
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
                  <Link href={categoryHref} className="hover:underline">
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
            </dl>
            <div className="mt-2">
              <Button size="lg" type="button">
                Add to Cart
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </div>
  )
}
