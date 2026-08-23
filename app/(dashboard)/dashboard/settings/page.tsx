import { PageHeader } from "@/components/layout/page-header"
import { Container } from "@/components/layout/container"
import { requireAdminOrRedirect } from "@/lib/auth/admin"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  // SECURITY: admin authorization happens server-side before any data load.
  await requireAdminOrRedirect()

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