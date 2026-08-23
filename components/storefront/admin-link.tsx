/**
 * ShopNova - Storefront admin link.
 *
 * A server component that renders a link to the admin dashboard ONLY when the
 * current Clerk user is an administrator (privateMetadata.role === "admin").
 *
 * This is a UI convenience only — it is NOT the security boundary. The admin
 * area is protected server-side by `requireAdminOrRedirect()` on every page
 * and `requireAdmin()` on every server action. A non-admin who manually
 * navigates to /dashboard is rejected server-side regardless of this link.
 */
import Link from "next/link"
import { Shield } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { getAdminContext } from "@/lib/auth/admin"
import { cn } from "@/lib/utils"

export async function AdminLink() {
  const admin = await getAdminContext()
  if (!admin) return null

  return (
    <Link
      href="/dashboard"
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "gap-1.5"
      )}
    >
      <Shield className="h-4 w-4" />
      Admin
    </Link>
  )
}
