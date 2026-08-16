import { PageHeader } from "@/components/layout/page-header"
import { Container } from "@/components/layout/container"
import { DeleteEntityDialog } from "@/components/dashboard/delete-entity-dialog"
import { TableCard } from "@/components/dashboard/table-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { listProducts, listCategories } from "@/lib/db"
import { ProductForm } from "./product-form"
import { deleteProductAction } from "./actions"

export const dynamic = "force-dynamic"

export default async function ProductsPage() {
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
      <TableCard
        isEmpty={products.length === 0}
        emptyMessage="No products yet. Create your first product to get started."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {product.sku || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {product.category.name}
                </TableCell>
                <TableCell className="text-right">
                  {product.price.toString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <ProductForm product={product} categories={categories} />
                    <DeleteEntityDialog
                      entityLabel="Product"
                      entity={product}
                      action={deleteProductAction}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </Container>
  )
}
