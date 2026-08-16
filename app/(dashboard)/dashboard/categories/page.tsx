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
import { listCategories } from "@/lib/db"
import { CategoryForm } from "./category-form"
import { deleteCategoryAction } from "./actions"

export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
  const categories = await listCategories()

  return (
    <Container>
      <PageHeader
        title="Categories"
        description="Organize products by categories."
      >
        <CategoryForm />
      </PageHeader>
      <TableCard
        isEmpty={categories.length === 0}
        emptyMessage="No categories yet. Create your first category to get started."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="text-muted-foreground">{category.slug}</TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">
                  {category.description || "—"}
                </TableCell>
                <TableCell className="text-right">{category._count.products}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <CategoryForm category={category} />
                    <DeleteEntityDialog
                      entityLabel="Category"
                      entity={category}
                      action={deleteCategoryAction}
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
