import { PageHeader } from "@/components/layout/page-header"
import { Container } from "@/components/layout/container"
import { LayoutDashboard } from "lucide-react"

export default function DashboardPage() {
  return (
    <Container>
      <PageHeader
        title="Dashboard"
        description="Overview of your store's performance."
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["Total Revenue", "Orders", "Customers", "Products", "Growth", "Active Now"].map((label) => (
          <div key={label} className="rounded-lg border p-6">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">{label}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold">—</p>
          </div>
        ))}
      </div>
    </Container>
  )
}