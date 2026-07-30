import { Container } from "@/components/layout/container"
import { PageHeader } from "@/components/layout/page-header"

export default function PricingPage() {
  return (
    <Container className="py-12">
      <PageHeader title="Pricing" description="Explore our pricing plans." />
      <div className="mt-8 rounded-lg border p-8 text-center text-muted-foreground">
        <p>Pricing page content coming soon.</p>
      </div>
    </Container>
  )
}