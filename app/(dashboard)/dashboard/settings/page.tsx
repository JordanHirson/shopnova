import { PageHeader } from "@/components/layout/page-header"
import { Container } from "@/components/layout/container"

export default function SettingsPage() {
  return (
    <Container>
      <PageHeader
        title="Settings"
        description="Configure your store settings."
      />
      <div className="mt-8 rounded-lg border p-12 text-center text-muted-foreground">
        <p>Settings coming soon.</p>
      </div>
    </Container>
  )
}