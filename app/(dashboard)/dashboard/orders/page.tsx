import { PageHeader } from "@/components/layout/page-header"
import { Container } from "@/components/layout/container"

export default function OrdersPage() {
  return (
    <Container>
      <PageHeader
        title="Orders"
        description="View and manage customer orders."
      />
      <div className="mt-8 rounded-lg border p-12 text-center text-muted-foreground">
        <p>Order management coming soon.</p>
      </div>
    </Container>
  )
}