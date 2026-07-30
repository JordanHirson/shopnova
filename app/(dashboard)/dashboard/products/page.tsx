import { PageHeader } from "@/components/layout/page-header"
import { Container } from "@/components/layout/container"

export default function ProductsPage() {
  return (
    <Container>
      <PageHeader
        title="Products"
        description="Manage your product catalog."
      />
      <div className="mt-8 rounded-lg border p-12 text-center text-muted-foreground">
        <p>Product management coming soon.</p>
      </div>
    </Container>
  )
}