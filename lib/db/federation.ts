/**
 * Catalog Federation data layer (GUIDEBOOK §8).
 *
 * Implements the federation workflow described in the GUIDEBOOK:
 *   - create/list federation links for the default store,
 *   - run a sync that pulls products from an upstream source, applies a
 *     markup rule, and upserts them as `Product` rows tied to the link,
 *   - record each run as a `FederationSyncRun` (RUNNING → SUCCESS/FAILED).
 *
 * The upstream source is the mock Shopify connector (`shopify-mock.ts`).
 * The runner is written exactly as the GUIDEBOOK prescribes, so replacing
 * the mock with a real Shopify client later requires no changes here.
 */
import { prisma } from "./prisma"
import { getDefaultStoreId } from "./store"
import { listMockProducts, type UpstreamProduct } from "@/lib/federation/mock-sources"

// ── Markup rules (GUIDEBOOK §8 "Markup Rules") ──────────────────────

export type MarkupType = "percentage" | "fixed"

export interface MarkupRule {
  type: MarkupType
  value: number
}

/**
 * Applies a markup rule to a base upstream price.
 * Mirrors the GUIDEBOOK reference implementation:
 *   - percentage: base * (1 + value/100)
 *   - fixed:      base + value
 * Result is rounded to 2 decimals to fit Decimal(10,2).
 */
export function applyMarkup(basePrice: number, rule: MarkupRule): number {
  const marked =
    rule.type === "percentage"
      ? basePrice * (1 + rule.value / 100)
      : basePrice + rule.value
  return Math.round(marked * 100) / 100
}

// ── Link config shape (stored in FederationLink.config JSON) ─────────

export interface FederationLinkConfig {
  markup: MarkupRule
  syncIntervalMinutes: number
  /** Category id (within the default store) to assign imported products to. */
  categoryId: string
}

// ── Link CRUD ────────────────────────────────────────────────────────

export interface FederationLinkInput {
  name: string
  source: string
  config: FederationLinkConfig
}

/**
 * Lists all federation links for the default store with their latest sync run
 * and current federated product count.
 */
export async function listFederationLinks() {
  const storeId = await getDefaultStoreId()
  if (!storeId) return []

  return prisma.federationLink.findMany({
    where: { storeId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { products: true } },
      syncRuns: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  })
}

/**
 * Returns a single federation link by id for the default store.
 */
export async function getFederationLinkById(id: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) return null

  return prisma.federationLink.findFirst({
    where: { id, storeId },
  })
}

/**
 * Creates a new federation link for the default store.
 */
export async function createFederationLink(input: FederationLinkInput) {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store found. Create a store before adding federation sources.")
  }

  // Validate the target category belongs to the same store.
  const category = await prisma.category.findFirst({
    where: { id: input.config.categoryId, storeId },
    select: { id: true },
  })
  if (!category) {
    throw new Error("Selected category not found.")
  }

  return prisma.federationLink.create({
    data: {
      storeId,
      source: input.source,
      name: input.name,
      config: input.config as unknown as import("@prisma/client").Prisma.JsonObject,
    },
  })
}

/**
 * Deletes a federation link for the default store.
 *
 * Cascade rules from the Prisma schema handle related rows:
 *   - FederationSyncRun rows are cascade-deleted with the link.
 *   - Products keep their rows but have `federationLinkId` set to null
 *     (onDelete: SetNull), so historical orders stay intact.
 */
export async function deleteFederationLink(id: string) {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store found.")
  }

  // Ensure the link belongs to the default store before deleting.
  const link = await prisma.federationLink.findFirst({
    where: { id, storeId },
    select: { id: true },
  })
  if (!link) {
    throw new Error("Federation source not found.")
  }

  await prisma.federationLink.delete({ where: { id } })
}

/**
 * Lists recent sync runs for a federation link (most recent first).
 */
export async function listFederationSyncRuns(linkId: string, take = 10) {
  const storeId = await getDefaultStoreId()
  if (!storeId) return []

  // Ensure the link belongs to the default store before surfacing its runs.
  const link = await prisma.federationLink.findFirst({
    where: { id: linkId, storeId },
    select: { id: true },
  })
  if (!link) return []

  return prisma.federationSyncRun.findMany({
    where: { federationLinkId: linkId },
    orderBy: { startedAt: "desc" },
    take,
  })
}

// ── Sync runner (GUIDEBOOK §8 "Sync Runner") ─────────────────────────

/**
 * Runs a federation sync for the given link id.
 *
 * Mirrors the GUIDEBOOK reference `syncShopify(linkId)`:
 *   1. Load the link + decrypt config (here config is plain JSON in dev).
 *   2. Create a FederationSyncRun with status RUNNING.
 *   3. Page through upstream products; for each, upsert a federated Product
 *      (matched by externalId) with markup applied to the price.
 *   4. Update the run to SUCCESS with created/updated counts.
 *   5. On failure, mark the run FAILED and rethrow.
 */
export async function runFederationSync(linkId: string): Promise<{
  runId: string
  created: number
  updated: number
}> {
  const storeId = await getDefaultStoreId()
  if (!storeId) {
    throw new Error("No store found.")
  }

  const link = await prisma.federationLink.findFirst({
    where: { id: linkId, storeId },
  })
  if (!link) {
    throw new Error("Federation source not found.")
  }

  const config = link.config as unknown as FederationLinkConfig
  if (!config?.markup || !config?.categoryId) {
    throw new Error("Federation source is missing required configuration.")
  }

  const run = await prisma.federationSyncRun.create({
    data: { federationLinkId: linkId, status: "RUNNING" },
  })

  try {
    let created = 0
    let updated = 0
    let cursor: string | null = null

    do {
      const { products, nextCursor } = await listMockProducts(link.source)
      for (const upstream of products) {
        const result = await upsertFederatedProduct({
          storeId,
          linkId,
          config,
          upstream,
        })
        if (result.created) created++
        else updated++
      }
      cursor = nextCursor
    } while (cursor)

    await prisma.federationSyncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        productsCreated: created,
        productsUpdated: updated,
        endedAt: new Date(),
      },
    })

    await prisma.federationLink.update({
      where: { id: linkId },
      data: { lastSyncedAt: new Date(), errorMessage: null },
    })

    return { runId: run.id, created, updated }
  } catch (err) {
    await prisma.federationSyncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errors: { message: err instanceof Error ? err.message : String(err) },
        endedAt: new Date(),
      },
    })
    await prisma.federationLink.update({
      where: { id: linkId },
      data: {
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    })
    throw err
  }
}

/**
 * Upserts a single federated product:
 *   1. If a product already exists for this link + externalId → update it
 *      (re-applying markup so upstream price changes flow through).
 *   2. Otherwise, if an orphaned product with the same externalId exists
 *      (federationLinkId = null — left behind when a source was removed),
 *      re-link it to this federation link and update it, instead of creating
 *      a duplicate that would violate the (storeId, slug) unique constraint.
 *   3. Otherwise, create a new product with a store-unique slug.
 */
async function upsertFederatedProduct(args: {
  storeId: string
  linkId: string
  config: FederationLinkConfig
  upstream: UpstreamProduct
}): Promise<{ created: boolean }> {
  const { storeId, linkId, config, upstream } = args

  const markedPrice = applyMarkup(upstream.price, config.markup)

  // 1. Same-link re-sync.
  let existing = await prisma.product.findFirst({
    where: { federationLinkId: linkId, externalId: upstream.externalId },
    select: { id: true },
  })

  // 2. Re-link an orphaned product left behind by a removed source.
  if (!existing) {
    existing = await prisma.product.findFirst({
      where: { storeId, externalId: upstream.externalId, federationLinkId: null },
      select: { id: true },
    })
  }

  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: {
        federationLinkId: linkId,
        externalId: upstream.externalId,
        categoryId: config.categoryId,
        name: upstream.title,
        description: upstream.description,
        price: markedPrice,
        sku: upstream.sku,
        inventory: {
          upsert: {
            create: { quantity: upstream.inventory },
            update: { quantity: upstream.inventory },
          },
        },
      },
    })
    return { created: false }
  }

  // 3. Genuinely new product — ensure slug uniqueness within the store.
  const slug = await uniqueSlug(storeId, slugify(upstream.title))

  await prisma.product.create({
    data: {
      storeId,
      categoryId: config.categoryId,
      federationLinkId: linkId,
      externalId: upstream.externalId,
      name: upstream.title,
      slug,
      description: upstream.description,
      price: markedPrice,
      sku: upstream.sku,
      images: upstream.imageUrl
        ? { create: [{ url: upstream.imageUrl, sortOrder: 0 }] }
        : undefined,
      inventory: { create: { quantity: upstream.inventory } },
    },
  })
  return { created: true }
}

/**
 * Returns a slug unique within the store, appending `-2`, `-3`, … if the base
 * slug already belongs to another product (e.g. a manually-created one).
 */
async function uniqueSlug(storeId: string, baseSlug: string): Promise<string> {
  let slug = baseSlug
  let suffix = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const conflict = await prisma.product.findFirst({
      where: { storeId, slug },
      select: { id: true },
    })
    if (!conflict) return slug
    suffix++
    slug = `${baseSlug}-${suffix}`
  }
}

/** Converts a title into a URL-friendly slug matching the Product slug regex. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
