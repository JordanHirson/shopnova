import { PageHeader } from "@/components/layout/page-header"
import { Container } from "@/components/layout/container"

export default function CategoriesPage() {
  return (
    <Container>
      <PageHeader
        title="Categories"
        description="Organize products by categories."
      />
      <div className="mt-8 rounded-lg border p-12 text-center text-muted-foreground">
        <p>Category management coming soon.</p>
      </div>
    </Container>
  )
}