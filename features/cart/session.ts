/** ShopNova - Cart shopper/session identity.
 *
 * Strategy:
 *   - Signed-in shoppers => `user:<clerkUserId>` from Clerk's `auth()`.
 *   - Anonymous shoppers  => `anon:<uuid>` stored in an httpOnly cookie.
 *
 * This keeps carts per-shopper without creating unnecessary Customer
 * records (customers are only created during checkout). The cart works
 * before sign-in; when the shopper later signs in, their cart is keyed
 * by their Clerk user id.
 */
import "server-only"

import { cookies } from "next/headers"
import { auth } from "@clerk/nextjs/server"
import { randomUUID } from "crypto"

const ANON_COOKIE_NAME = "shopnova_cart_id"
const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

/**
 * Returns a stable shopper id used to key a cart in the cart store.
 * Creates the anonymous cookie on first visit when the shopper is not
 * signed in.
 */
export async function getShopperId(): Promise<string> {
  const { userId } = await auth()
  if (userId) return `user:${userId}`

  const cookieStore = await cookies()
  const existing = cookieStore.get(ANON_COOKIE_NAME)?.value
  if (existing) return `anon:${existing}`

  const id = randomUUID()
  cookieStore.set(ANON_COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ANON_COOKIE_MAX_AGE,
    path: "/",
  })
  return `anon:${id}`
}