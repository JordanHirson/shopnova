import Link from "next/link"
import { Users } from "lucide-react"

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
import { buttonVariants } from "@/components/ui/button"
import { listCustomers } from "@/lib/db"
import { requireAdminOrRedirect } from "@/lib/auth/admin"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

function formatDate(value: Date) {
  return value.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function displayName(customer: {
  firstName: string | null
  lastName: string | null
  email: string
}) {
  const first = customer.firstName ?? ""
  const last = customer.lastName ?? ""
  const name = `${first} ${last}`.trim()
  return name || customer.email.split("@")[0]
}

export default async function CustomersPage() {
  // SECURITY: admin authorization happens server-side before any data load.
  await requireAdminOrRedirect()

  const customers = await listCustomers()

  return (
    <Container>
      <PageHeader
        title="Customers"
        description="View your customer base."
      />
      <div className="mt-8 rounded-lg border">
        {customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="mt-4 font-medium text-foreground">No customers yet</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Customers are created automatically when someone completes checkout.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    {displayName(customer)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(customer.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {customer._count.orders}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/customers/${customer.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Container>
  )
}
