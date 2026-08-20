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
import { ProductForm, DeleteProductButton } from "./product-form"

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
                    R {product.price.toString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ProductForm product={product} categories={categories} />
                      <DeleteProductButton product={product} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Container>
  )
}