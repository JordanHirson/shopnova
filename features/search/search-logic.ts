/**
 * ShopNova - Storefront product search business logic (pure).
 *
 * This module is the single source of truth for the search *contract*:
 *   - how a raw query string is normalized and validated,
 *   - which product fields are searched,
 *   - what "match" means (case-insensitive substring),
 *   - that archived products are never matched,
 *   - how results are ordered and limited.
 *
 * `productMatchesSearch` / `searchProducts` are pure reference
 * implementations of that contract. The database query in
 * `lib/db/products.ts` (`searchStorefrontProducts`) mirrors the same
 * field list and matching semantics using Prisma
 * `contains` + `mode: "insensitive"`, so the unit tests here verify the
 * behavior the shopper will see without needing a live database.
 *
 * Run tests with:
 *   node --test --experimental-strip-types features/search/search-logic.test.ts
 */

/** Maximum length of an accepted search query (after normalization). */
export const MAX_SEARCH_QUERY_LENGTH = 100

/** Default (and maximum) number of search results returned per page. */
export const DEFAULT_SEARCH_LIMIT = 24

/**
 * The product text fields searched by storefront search.
 * Kept in sync with `searchStorefrontProducts` in `lib/db/products.ts`.
 */
export const SEARCHABLE_PRODUCT_FIELDS = ["name", "description", "sku"] as const

/**
 * The related category text fields searched by storefront search.
 */
export const SEARCHABLE_CATEGORY_FIELDS = ["name"] as const

/** The searchable text fields of a product, used by the pure matcher. */
export interface SearchableProduct {
  name: string
  description: string | null
  sku: string | null
  archived: boolean
  category: { name: string } | null
}

/**
 * Normalize a raw search input: trim leading/trailing whitespace and
 * collapse internal runs of whitespace to single spaces.
 *
 * Returns an empty string for null/undefined/blank input.
 */
export function normalizeSearchQuery(
  input: string | null | undefined
): string {
  if (!input) return ""
  return input.trim().replace(/\s+/g, " ")
}

/**
 * A query is valid when it is non-empty (after trimming) and does not
 * exceed the maximum length. Over-long queries are rejected so a malicious
 * or accidental huge input can never trigger an expensive database scan.
 *
 * Safe to call on either raw or already-normalized input.
 */
export function isValidSearchQuery(query: string): boolean {
  const trimmed = query.trim()
  return trimmed.length > 0 && trimmed.length <= MAX_SEARCH_QUERY_LENGTH
}

export interface ParsedSearch {
  /** Normalized query string (trimmed, collapsed whitespace). */
  query: string
  /** Whether the normalized query is a valid search. */
  isValid: boolean
}

/** Parse + validate a raw search input in one step. */
export function parseSearchQuery(
  input: string | null | undefined
): ParsedSearch {
  const query = normalizeSearchQuery(input)
  return { query, isValid: isValidSearchQuery(query) }
}

/**
 * Returns the search term to apply, or `null` when the input should NOT
 * trigger a search (missing / blank / too long). The caller treats `null`
 * as "browse all products" rather than "search for nothing".
 */
export function getSearchTerm(
  input: string | null | undefined
): string | null {
  const { query, isValid } = parseSearchQuery(input)
  return isValid ? query : null
}

/**
 * Clamp a requested result limit to a safe positive value bounded by
 * `DEFAULT_SEARCH_LIMIT`. Falsy / non-positive / oversized values fall
 * back to the default.
 */
export function clampSearchLimit(
  requested: number | null | undefined
): number {
  if (!requested || requested <= 0) return DEFAULT_SEARCH_LIMIT
  if (requested > DEFAULT_SEARCH_LIMIT) return DEFAULT_SEARCH_LIMIT
  return Math.floor(requested)
}

/**
 * Returns true if the product matches the search term.
 *
 * Match semantics (mirrored by the Prisma query):
 *   - case-insensitive substring (`contains`) match,
 *   - across product name, description, sku, and category name,
 *   - archived products NEVER match (they are hidden from the storefront).
 *
 * Empty/null fields are treated as empty strings so they never match a
 * non-empty term.
 */
export function productMatchesSearch(
  product: SearchableProduct,
  term: string
): boolean {
  if (product.archived) return false
  const needle = term.toLowerCase()
  if (needle === "") return false
  const haystacks = [
    product.name,
    product.description ?? "",
    product.sku ?? "",
    product.category?.name ?? "",
  ]
  return haystacks.some((h) => h.toLowerCase().includes(needle))
}

/**
 * Pure reference implementation of storefront search over an in-memory
 * list. Filters by `productMatchesSearch`, orders by name ascending
 * (stable, predictable ordering), and applies the clamped limit.
 *
 * The database query `searchStorefrontProducts` produces the same
 * ordering and limiting; this function exists so the search contract can
 * be unit-tested without a database.
 */
export function searchProducts<T extends SearchableProduct>(
  products: T[],
  term: string | null | undefined,
  limit: number | null | undefined = DEFAULT_SEARCH_LIMIT
): T[] {
  const normalized = normalizeSearchQuery(term)
  if (!isValidSearchQuery(normalized)) return []
  const max = clampSearchLimit(limit)
  return products
    .filter((p) => productMatchesSearch(p, normalized))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, max)
}
