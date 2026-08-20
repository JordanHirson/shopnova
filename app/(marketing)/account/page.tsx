import Link from "next/link"
import { redirect } from "next/navigation"
import { auth, currentUser } from "@clerk/nextjs/server"
import { Package, ShoppingBag, User } from "lucide-react"

import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { getCustomerForClerkUser } from "@/lib/db/customers"
import { buildDisplayName } from "@/features/account/account-logic"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AccountPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in?redirect_url=/account")

  const user = await currentUser()
  const primaryEmail = user?.emailAddresses?.find(
    (e) => e.id === user?.primaryEmailAddressId
  )?.emailAddress
  const displayName = buildDisplayName(
    user?.firstName,
    user?.lastName,
    primaryEmail
  )

  const customer = await getCustomerForClerkUser(userId)
  const orderCount = customer?._count.orders ?? 0

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Your account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your profile and review your orders.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {/* Profile card */}
            <section className="rounded-lg border p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {displayName}
                  </p>
                  {primaryEmail ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {primaryEmail}
                    </p>
                  ) : null}
                </div>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">First name</dt>
                  <dd className="font-medium text-foreground">
                    {user?.firstName ?? customer?.firstName ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Last name</dt>
                  <dd className="font-medium text-foreground">
                    {user?.lastName ?? customer?.lastName ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="font-medium text-foreground">
                    {customer?.phone ?? "—"}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Orders card */}
            <section className="flex flex-col rounded-lg border p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Orders</p>
                  <p className="text-sm text-muted-foreground">
                    {orderCount} {orderCount === 1 ? "order" : "orders"} placed
                  </p>
                </div>
              </div>
              <p className="mt-4 flex-1 text-sm text-muted-foreground">
                {customer
                  ? "View your order history and track individual orders."
                  : "Once you complete a signed-in checkout, your orders will appear here."}
              </p>
              <Link
                href="/account/orders"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "mt-4 w-fit gap-1.5"
                )}
              >
                <Package className="h-4 w-4" />
                View order history
              </Link>
            </section>
          </div>
        </div>
      </Container>
    </div>
  )
}
