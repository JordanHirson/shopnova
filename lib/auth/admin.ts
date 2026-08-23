/**
 * ShopNova - Server-side admin authorization.
 *
 * This is the security boundary for the entire admin area. Every admin page
 * and every admin server action MUST call `requireAdmin()` (or
 * `requireAdminOrRedirect()` for pages) before reading or mutating any data.
 *
 * Authorization approach:
 *   - Clerk is the authentication source of truth (no second auth system).
 *   - An admin is a Clerk user whose `privateMetadata.role === "admin"`.
 *     `privateMetadata` is only readable server-side via the Clerk Backend API
 *     (`currentUser()`), so a customer can never learn or forge admin status
 *     in the browser. Users cannot set their own privateMetadata; only the
 *     Clerk Backend API (secret key) can — see scripts/set-admin.ts.
 *   - The check runs server-side on every request and every server action, so
 *     a normal customer calling an admin server action directly is rejected.
 *
 * To grant admin access, set a Clerk user's privateMetadata:
 *   npm run set-admin -- <clerkUserId>
 * or via the Clerk Dashboard → Users → user → Private metadata → { "role": "admin" }.
 */
import "server-only"
import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import {
  AdminRequiredError,
  UnauthenticatedError,
  assertAdminRole,
  isAdminRole,
  roleFromMetadata,
} from "@/features/admin/admin-logic"

/** Result of an admin auth check that succeeded. */
export interface AdminContext {
  userId: string
}

/**
 * Returns the authenticated admin's Clerk user id, or null when the caller is
 * unauthenticated or not an admin. Use this for non-throwing checks (e.g. the
 * storefront header admin link).
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const { userId } = await auth()
  if (!userId) return null

  const user = await currentUser()
  if (!user) return null

  const role = roleFromMetadata(
    user.privateMetadata as Record<string, unknown> | null | undefined
  )
  if (!isAdminRole(role)) return null

  return { userId }
}

/**
 * Authorizes the current request as an admin. Throws `UnauthenticatedError`
 * when not signed in, or `AdminRequiredError` when signed in but not an admin.
 *
 * Use this in server actions — the thrown error is caught by the action and
 * surfaced as a user-friendly message, and no admin data is touched.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const { userId } = await auth()
  if (!userId) throw new UnauthenticatedError()

  const user = await currentUser()
  if (!user) throw new UnauthenticatedError()

  const role = roleFromMetadata(
    user.privateMetadata as Record<string, unknown> | null | undefined
  )
  assertAdminRole(role)

  return { userId }
}

/**
 * Authorizes the current request as an admin, redirecting to the sign-in page
 * when unauthenticated and to a "not authorized" page when not an admin.
 *
 * Use this at the top of admin pages (server components). This mirrors the
 * in-page `redirect()` pattern already used by the `/account` area, which is
 * the recommended resource-based approach under Clerk v7 + Next.js 16
 * (middleware `auth.protect()` is deprecated and returns 404).
 */
export async function requireAdminOrRedirect(): Promise<AdminContext> {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in?redirect_url=/dashboard")

  const user = await currentUser()
  if (!user) redirect("/sign-in?redirect_url=/dashboard")

  const role = roleFromMetadata(
    user.privateMetadata as Record<string, unknown> | null | undefined
  )
  if (!isAdminRole(role)) {
    redirect("/dashboard/unauthorized")
  }

  return { userId }
}

export { AdminRequiredError, UnauthenticatedError }
