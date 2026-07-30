import { Container } from "@/components/layout/container"
import { PageHeader } from "@/components/layout/page-header"

export default function ContactPage() {
  return (
    <Container className="py-12">
      <PageHeader title="Contact" description="Get in touch with the ShopNova team." />
      <div className="mt-8 rounded-lg border p-8 text-center text-muted-foreground">
        <p>Contact page content coming soon.</p>
      </div>
    </Container>
  )
}