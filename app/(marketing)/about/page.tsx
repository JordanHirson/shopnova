import { Container } from "@/components/layout/container"
import { PageHeader } from "@/components/layout/page-header"

export default function AboutPage() {
  return (
    <Container className="py-12">
      <PageHeader title="About" description="Learn more about ShopNova." />
      <div className="mt-8 rounded-lg border p-8 text-center text-muted-foreground">
        <p>About page content coming soon.</p>
      </div>
    </Container>
  )
}