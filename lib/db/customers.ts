/**
 * ShopNova - Customer database helpers.
 *
 * Resolves the authenticated Clerk user to the existing Customer row.
 * Clerk is the authentication source of truth; the Customer row is the
 * commerce record (created during checkout). The link between them is the
 * nullable, unique `Customer.clerkUserId` column, set when a signed-in
 * shopper completes checkout.
 *
 * SECURITY: every account-area order query MUST go through the customer id
 * resolved here. The browser is never trusted.
 */
import { prisma } from "./prisma"
import { getDefaultStoreId } from "./store"

/**
 * Returns the Customer linked to the given Clerk user id within the default
 * store, or null when no Customer exists yet (e.g. a brand-new account that
 * has never completed a signed-in checkout).
 */
export async function getCustomerForClerkUser(
  clerkUserId: string
) {
  const storeId = await getDefaultStoreId()
  if (!storeId) return null

  return prisma.customer.findUnique({
    where: { clerkUserId },
    include: {
      _count: { select: { orders: true } },
    },
  })
}
