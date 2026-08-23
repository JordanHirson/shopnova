/**
 * ShopNova - Grant or revoke the admin role for a Clerk user.
 *
 * Sets the Clerk user's `privateMetadata.role` to `"admin"` (or removes it).
 * `privateMetadata` is only readable server-side via the Clerk Backend API, so
 * a customer can never learn or forge admin status in the browser. Users
 * cannot set their own privateMetadata — only this script (using the
 * CLERK_SECRET_KEY) or the Clerk Dashboard can.
 *
 * Usage:
 *   npm run set-admin -- <clerkUserId>            # grant admin
 *   npm run set-admin -- <clerkUserId> --remove   # revoke admin
 *
 * Requires CLERK_SECRET_KEY in your environment (.env.local).
 */
import { createClerkClient } from "@clerk/backend"

// Load env the same way the seed script does.
try {
  process.loadEnvFile(".env.local")
} catch {
  try {
    process.loadEnvFile(".env")
  } catch {
    // env may come from the environment directly
  }
}

const secretKey = process.env.CLERK_SECRET_KEY
if (!secretKey) {
  console.error(
    "CLERK_SECRET_KEY is not set. Add it to your .env.local before running this script."
  )
  process.exit(1)
}

const args = process.argv.slice(2)
const removeFlag = args.includes("--remove")
const userId = args.find((a) => !a.startsWith("--"))

if (!userId) {
  console.error("Usage: npm run set-admin -- <clerkUserId> [--remove]")
  process.exit(1)
}

const clerkClient = createClerkClient({ secretKey })

try {
  if (removeFlag) {
    // Remove only the `role` key, leaving any other private metadata intact.
    // Clerk treats a null value as "delete this key".
    await clerkClient.users.updateUserMetadata(userId, {
      privateMetadata: { role: null },
    })
    console.log(`Admin role revoked for user ${userId}.`)
  } else {
    await clerkClient.users.updateUserMetadata(userId, {
      privateMetadata: { role: "admin" },
    })
    console.log(`Admin role granted to user ${userId}.`)
  }
} catch (err) {
  console.error(
    "Failed to update user metadata:",
    err instanceof Error ? err.message : String(err)
  )
  process.exit(1)
}
