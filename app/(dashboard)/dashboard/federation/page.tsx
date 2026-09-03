import { PageHeader } from "@/components/layout/page-header"
import { Container } from "@/components/layout/container"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { listCategories, listFederationLinks, listFederationSyncRuns } from "@/lib/db"
import { requireAdminOrRedirect } from "@/lib/auth/admin"
import { FederationForm } from "./federation-form"
import { SyncButton } from "./sync-button"
import { RemoveFederationButton } from "./remove-button"

export const dynamic = "force-dynamic"

/** Formats an ISO date for display, safely handling null. */
function formatDateTime(iso: Date | string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString()
}

/** Renders a colored status pill for a sync run / link state. */
function StatusPill({ status }: { status: string }) {
  const cls =
    status === "SUCCESS"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : status === "RUNNING"
        ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
        : status === "FAILED"
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground"
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  )
}

export default async function FederationPage() {
  // SECURITY: admin authorization happens server-side before any data load.
  await requireAdminOrRedirect()

  const [categories, links] = await Promise.all([
    listCategories(),
    listFederationLinks(),
  ])

  // Fetch recent sync runs for every link in parallel so the page can show
  // the latest run status alongside each source.
  const runsByLink = await Promise.all(
    links.map(async (link) => ({
      linkId: link.id,
      runs: await listFederationSyncRuns(link.id, 5),
    }))
  )
  const runsMap = new Map(runsByLink.map((r) => [r.linkId, r.runs]))

  return (
    <Container>
      <PageHeader
        title="Catalog Federation"
        description="Link external stores, import their products, and resell with auto-sync and markup."
      >
        <FederationForm categories={categories} />
      </PageHeader>

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Linked sources
          </h2>
          <div className="rounded-lg border">
            {links.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <p>
                  No federation sources yet. Link a Shopify store to start
                  importing products.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead>Last sync</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-40 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link) => {
                    const latestRun = link.syncRuns[0]
                    const status = latestRun?.status ?? "PENDING"
                    return (
                      <TableRow key={link.id}>
                        <TableCell className="font-medium uppercase">
                          {link.source}
                        </TableCell>
                        <TableCell>{link.name}</TableCell>
                        <TableCell className="text-right">
                          {link._count.products}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(link.lastSyncedAt)}
                        </TableCell>
                        <TableCell>
                          <StatusPill status={status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <SyncButton linkId={link.id} />
                            <RemoveFederationButton
                              linkId={link.id}
                              name={link.name}
                              productCount={link._count.products}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </section>

        {links.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Recent sync runs
            </h2>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Ended</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.flatMap((link) =>
                    (runsMap.get(link.id) ?? []).map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="font-medium">{link.name}</TableCell>
                        <TableCell>
                          <StatusPill status={run.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {run.productsCreated}
                        </TableCell>
                        <TableCell className="text-right">
                          {run.productsUpdated}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(run.startedAt)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(run.endedAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        )}
      </div>
    </Container>
  )
}
