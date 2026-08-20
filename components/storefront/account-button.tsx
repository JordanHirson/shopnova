/**
 * ShopNova - Header account link.
 *
 * Shows a "Sign in" link for anonymous shoppers and an "Account" link
 * (plus the Clerk UserButton) for signed-in shoppers. Authentication
 * state comes from Clerk; this component never trusts the browser for
 * authorization — server-side `auth()` and the customer-scoped order
 * queries remain the security boundary.
 */
"use client"

import Link from "next/link"
import { UserButton, useAuth } from "@clerk/nextjs"
import { User } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function AccountButton() {
  const { isSignedIn, isLoaded } = useAuth()

  if (!isLoaded) {
    // Reserve layout space to avoid header shift on hydration.
    return <div className="h-8 w-20" aria-hidden />
  }

  if (!isSignedIn) {
    return (
      <Link
        href="/sign-in"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-1.5"
        )}
      >
        <User className="h-4 w-4" />
        Sign in
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/account"
        className="inline-flex items-center gap-1.5 rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Your account"
      >
        <User className="h-5 w-5" />
      </Link>
      <UserButton />
    </div>
  )
}
