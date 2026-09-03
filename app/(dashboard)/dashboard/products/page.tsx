import { PageHeader } from "@/components/layout/page-header"
import { Container } from "@/components/layout/container"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { listProducts, listCategories } from "@/lib/db"
import { requireAdminOrRedirect } from "@/lib/auth/admin"
import { ProductForm, DeleteProductButton, RestoreProductButton } from "./product-form"

export const dynamic = "force-dynamic"

/**
 * Strips Prisma `Decimal` objects from a product so it can be passed to a
 * Client Component. Next.js only allows plain objects across the Server →
 * Client boundary; `Decimal` is a class instance and triggers
 * "Only plain objects can be passed to Client Components from Server
 * Components. Decimal objects are not supported." The `price` and
 * `compareAtPrice` fields are serialized to strings, which is what the
 * product form (and the table display) already expect.
 */
function serializeProduct(product: Awaited<ReturnType<typeof listProducts>>[number]) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price.toString(),
    compareAtPrice: product.compareAtPrice?.toString() ?? null,
    sku: product.sku,
    categoryId: product.categoryId,
    archived: product.archived,
    category: { id: product.category.id, name: product.category.name },
    images: product.images.map((image) => ({ url: image.url })),
    inventory: product.inventory
      ? { quantity: product.inventory.quantity }
      : null,
    weightGrams: product.weightGrams,
    lengthCm: product.lengthCm,
    widthCm: product.widthCm,
    heightCm: product.heightCm,
  }
}

export default async function ProductsPage() {
  // SECURITY: admin authorization happens server-side before any data load.
  await requireAdminOrRedirect()

  const [products, categories] = await Promise.all([
    listProducts(),
    listCategories(),
  ])

  const serializedProducts = products.map(serializeProduct)

  return (
    <Container>
      <PageHeader
        title="Products"
        description="Manage your product catalog."
      >
        <ProductForm categories={categories} />
      </PageHeader>
      <div className="mt-8 rounded-lg border">
        {serializedProducts.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p>No products yet. Create your first product to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serializedProducts.map((product) => {
                const stock = product.inventory?.quantity ?? null
                return (
                  <TableRow key={product.id} className={product.archived ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.sku || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.category.name}
                    </TableCell>
                    <TableCell className="text-right">
                      R {product.price}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {stock === null ? "—" : stock}
                    </TableCell>
                    <TableCell>
                      {product.archived ? (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Archived
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          Active
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ProductForm product={product} categories={categories} />
                        {product.archived ? (
                          <RestoreProductButton product={product} />
                        ) : (
                          <DeleteProductButton product={product} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </Container>
  )
}
