import { AlertTriangle } from "lucide-react"

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
import { listInventory } from "@/lib/db"
import { requireAdminOrRedirect } from "@/lib/auth/admin"
import { InventoryForm } from "./inventory-form"

export const dynamic = "force-dynamic"

export default async function InventoryPage() {
  // SECURITY: admin authorization happens server-side before any data load.
  await requireAdminOrRedirect()

  const inventory = await listInventory()

  return (
    <Container>
      <PageHeader
        title="Inventory"
        description="Track stock levels and adjust quantities."
      />
      <div className="mt-8 rounded-lg border">
        {inventory.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p>No inventory records yet. Products without inventory will appear once seeded.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Low-stock threshold</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory.map((row) => {
                const isLow = row.quantity <= row.lowStockThreshold
                return (
                  <TableRow key={row.id} className={row.product.archived ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">
                      {row.product.name}
                      {row.product.archived ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Archived
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.product.sku || "—"}
                    </TableCell>
                    <TableCell className="text-right">{row.quantity}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.lowStockThreshold}
                    </TableCell>
                    <TableCell>
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          Low stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          In stock
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <InventoryForm
                        row={{
                          productId: row.productId,
                          productName: row.product.name,
                          quantity: row.quantity,
                          lowStockThreshold: row.lowStockThreshold,
                        }}
                      />
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
