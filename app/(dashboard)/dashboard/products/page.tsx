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

export default async function ProductsPage() {
  // SECURITY: admin authorization happens server-side before any data load.
  await requireAdminOrRedirect()

  const [products, categories] = await Promise.all([
    listProducts(),
    listCategories(),
  ])

  return (
    <Container>
      <PageHeader
        title="Products"
        description="Manage your product catalog."
      >
        <ProductForm categories={categories} />
      </PageHeader>
      <div className="mt-8 rounded-lg border">
        {products.length === 0 ? (
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
              {products.map((product) => {
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
                      R {product.price.toString()}
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
