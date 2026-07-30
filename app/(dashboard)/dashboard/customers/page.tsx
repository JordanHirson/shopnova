import { PageHeader } from "@/components/layout/page-header"
import { Container } from "@/components/layout/container"

export default function CustomersPage() {
  return (
    <Container>
      <PageHeader
        title="Customers"
        description="View your customer base."
      />
      <div className="mt-8 rounded-lg border p-12 text-center text-muted-foreground">
        <p>Customer management coming soon.</p>
      </div>
    </Container>
  )
}