import { auth } from "@clerk/nextjs/server"

/**
 * Returns the signed-in Clerk user id, or null when the request is anonymous.
 *
 * Server Actions are publicly reachable endpoints, so every mutating action
 * must check this itself instead of relying on route middleware alone.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth()
  return userId
}
