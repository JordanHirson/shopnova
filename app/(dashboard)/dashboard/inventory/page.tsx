import { PageHeader } from "@/components/layout/page-header"
import { Container } from "@/components/layout/container"

export default function InventoryPage() {
  return (
    <Container>
      <PageHeader
        title="Inventory"
        description="Track stock levels and inventory."
      />
      <div className="mt-8 rounded-lg border p-12 text-center text-muted-foreground">
        <p>Inventory management coming soon.</p>
      </div>
    </Container>
  )
}