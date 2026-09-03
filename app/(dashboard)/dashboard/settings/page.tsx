import { PageHeader } from "@/components/layout/page-header"
import { Container } from "@/components/layout/container"
import { requireAdminOrRedirect } from "@/lib/auth/admin"
import { getDefaultStore } from "@/lib/db/store"
import { resolveStoreTheme } from "@/lib/theme"
import { ThemeCustomizer } from "./theme-customizer"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  // SECURITY: admin authorization happens server-side before any data load.
  await requireAdminOrRedirect()

  const store = await getDefaultStore()
  const theme = resolveStoreTheme(
    store
      ? {
          themePreset: store.themePreset,
          primaryColor: store.primaryColor,
          accentColor: store.accentColor,
        }
      : { themePreset: null, primaryColor: null, accentColor: null }
  )

  return (
    <Container>
      <PageHeader
        title="Settings"
        description="Configure your store settings."
      />

      <section className="mt-8 space-y-6">
        <div className="rounded-lg border p-6">
          <h2 className="text-lg font-semibold">Theme &amp; Colors</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a preset or customize your storefront colors. Changes apply
            to the storefront immediately after saving.
          </p>
          <div className="mt-6">
            <ThemeCustomizer initialTheme={theme} />
          </div>
        </div>

        <div className="rounded-lg border p-12 text-center text-muted-foreground">
          <p>More settings coming soon.</p>
        </div>
      </section>
    </Container>
  )
}
