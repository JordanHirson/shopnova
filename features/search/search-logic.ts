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

// ── Natural-language query parsing ─────────────

/**
 * Common colour names recognised by the natural-language parser. A colour
 * is only extracted when it appears as a whole word so that partial
 * substrings (e.g. "red" inside "tired") never produce a false positive.
 */
export const SEARCH_COLORS = [
  "red",
  "blue",
  "green",
  "black",
  "white",
  "yellow",
  "orange",
  "purple",
  "pink",
  "brown",
  "grey",
  "gray",
  "silver",
  "gold",
  "navy",
  "beige",
  "maroon",
  "teal",
  "olive",
  "cyan",
  "magenta",
  "turquoise",
  "charcoal",
] as const

/**
 * The structured intent extracted from a natural-language search query.
 *
 * Example: `"cozy jacket under R800"` parses to
 * `{ raw, maxPrice: 800, inclusive: false, color: null, keywords: ["cozy", "jacket"] }`.
 */
export interface ParsedNaturalLanguageSearch {
  /** The original normalized query string. */
  raw: string
  /** Extracted price cap in Rands, or null when none was found. */
  maxPrice: number | null
  /**
   * Whether the price cap is inclusive (<=) or strict (<).
   *
   * "under", "below", "beneath", "less than", and "cheaper than" are
   * STRICT — a product priced at exactly the cap does NOT match.
   * "up to", "max", "maximum", "or less", "or lower", and "and under"
   * are INCLUSIVE — a product priced at exactly the cap DOES match.
   */
  inclusive: boolean
  /** Extracted colour name, or null when none was found. */
  color: string | null
  /** Remaining keyword tokens after removing the price phrase and colour. */
  keywords: string[]
}

// Phrasings that mean STRICTLY less than the cap (exclusive).
const STRICT_PRICE_PHRASINGS = [
  "under",
  "below",
  "beneath",
  "less than",
  "cheaper than",
] as const

// Phrasings that mean less than OR EQUAL to the cap (inclusive).
const INCLUSIVE_PRICE_PHRASINGS = [
  "up to",
  "max",
  "maximum",
] as const

/**
 * Parses a natural-language search query into structured filters:
 * a price cap (`under R800`, `below r500`, `max R1000`, `less than R200`,
 * `up to R750`), a colour, and the remaining keyword tokens.
 *
 * Price-cap semantics:
 *   - "under", "below", "beneath", "less than", "cheaper than" → STRICT
 *     (a product at exactly the cap does NOT match).
 *   - "up to", "max", "maximum", "R500 or less", "R500 or lower",
 *     "R500 and under" → INCLUSIVE (a product at exactly the cap matches).
 *
 * Returns `{ raw, maxPrice: null, inclusive: false, color: null, keywords: [] }`
 * for blank/invalid input.
 */
export function parseNaturalLanguageQuery(
  input: string | null | undefined
): ParsedNaturalLanguageSearch {
  const raw = normalizeSearchQuery(input)
  if (!raw) {
    return { raw, maxPrice: null, inclusive: false, color: null, keywords: [] }
  }

  let working = raw
  let maxPrice: number | null = null
  let inclusive = false

  // Price cap: "under R800", "below r500", "max R1000", "less than R200",
  // "up to R750", "cheaper than R300".
  const strictAlt = STRICT_PRICE_PHRASINGS.join("|")
  const inclusiveAlt = INCLUSIVE_PRICE_PHRASINGS.join("|")
  const priceMatch = working.match(
    new RegExp(
      `\\b(?:${strictAlt}|${inclusiveAlt})\\s+r?\\s?(\\d+(?:[.,]\\d{1,2})?)\\b`,
      "i"
    )
  )
  if (priceMatch) {
    const value = Number(priceMatch[1].replace(",", "."))
    if (!Number.isNaN(value) && value > 0) {
      maxPrice = value
      // The matched phrase (before the number) determines inclusivity.
      const phrase = priceMatch[0].replace(/\s+r?\s?\d.*$/i, "").trim().toLowerCase()
      inclusive = INCLUSIVE_PRICE_PHRASINGS.some((p) => phrase === p || phrase.endsWith(p))
      working = working.replace(priceMatch[0], " ")
    }
  }
  if (maxPrice === null) {
    // Trailing phrasing: "R500 or less", "R500 or lower", "R500 and under".
    const trailingMatch = working.match(
      /\br\s?(\d+(?:[.,]\d{1,2})?)\s+(?:and under|or less|or lower|maximum)\b/i
    )
    if (trailingMatch) {
      const value = Number(trailingMatch[1].replace(",", "."))
      if (!Number.isNaN(value) && value > 0) {
        maxPrice = value
        // "and under", "or less", "or lower", "maximum" are all inclusive.
        inclusive = true
        working = working.replace(trailingMatch[0], " ")
      }
    }
  }

  // Colour: first whole-word match from the known colour list.
  let color: string | null = null
  for (const candidate of SEARCH_COLORS) {
    const re = new RegExp(`\\b${candidate}\\b`, "i")
    if (re.test(working)) {
      color = candidate
      working = working.replace(re, " ")
      break
    }
  }

  const keywords = normalizeSearchQuery(working)
    .split(" ")
    .filter((w) => w.length > 0)

  return { raw, maxPrice, inclusive, color, keywords }
}

// ── Parsed-search matching with highlights ──────

/** A searchable product extended with the price field needed for price-cap filtering. */
export interface SearchableProductWithPrice extends SearchableProduct {
  /** Product price in Rands (major units). */
  price: number
}

/** The product field a search highlight refers to. */
export type SearchHighlightField =
  | "name"
  | "description"
  | "sku"
  | "category"
  | "price"
  | "color"

/** A human-readable tag explaining why a product matched a search. */
export interface SearchHighlight {
  field: SearchHighlightField
  /** Display label, e.g. `Matches 'jacket'`, `Under R800.00`, `Color: red`. */
  label: string
}

/**
 * Finds the first field where `keyword` appears as a case-insensitive
 * substring, mirroring the field priority of `productMatchesSearch`.
 */
function findKeywordField(
  product: SearchableProduct,
  keyword: string
): SearchHighlightField | null {
  const needle = keyword.toLowerCase()
  if (needle === "") return null
  if (product.name.toLowerCase().includes(needle)) return "name"
  if ((product.description ?? "").toLowerCase().includes(needle)) return "description"
  if ((product.sku ?? "").toLowerCase().includes(needle)) return "sku"
  if ((product.category?.name ?? "").toLowerCase().includes(needle)) return "category"
  return null
}

/**
 * Tests a product against a parsed natural-language search and returns
 * the match result plus highlight tags explaining why it matched.
 *
 * Semantics:
 *   - Archived products never match.
 *   - When there is no price cap AND no colour, the query falls back to
 *     the existing raw substring contract (`productMatchesSearch`) so
 *     simple keyword searches behave exactly as before.
 *   - `maxPrice` is a hard filter: products priced above the cap never
 *     match. When `inclusive` is false (e.g. "under R50") a product at
 *     exactly the cap also does NOT match; when `inclusive` is true
 *     (e.g. "up to R50", "R50 or less") a product at exactly the cap
 *     DOES match.
 *   - `color` is a hard filter: the colour must appear in the product
 *     name or description.
 *   - `keywords` use OR semantics: at least one keyword must match across
 *     name / description / sku / category. When no keywords remain, the
 *     price and/or colour filters alone determine the match.
 */
export function productMatchesParsedSearch(
  product: SearchableProductWithPrice,
  parsed: ParsedNaturalLanguageSearch
): { matches: boolean; highlights: SearchHighlight[] } {
  if (product.archived) return { matches: false, highlights: [] }

  // No structured filters → preserve the existing substring contract.
  if (parsed.maxPrice === null && parsed.color === null) {
    if (parsed.raw && productMatchesSearch(product, parsed.raw)) {
      return {
        matches: true,
        highlights: [{ field: "name", label: `Matches ‘${parsed.raw}’` }],
      }
    }
    return { matches: false, highlights: [] }
  }

  const highlights: SearchHighlight[] = []

  if (parsed.maxPrice !== null) {
    // Strict (< cap): reject when price >= cap.
    // Inclusive (<= cap): reject when price > cap.
    const overCap = parsed.inclusive
      ? product.price > parsed.maxPrice
      : product.price >= parsed.maxPrice
    if (overCap) {
      return { matches: false, highlights: [] }
    }
    highlights.push({
      field: "price",
      label: parsed.inclusive
        ? `Up to R${parsed.maxPrice.toFixed(2)}`
        : `Under R${parsed.maxPrice.toFixed(2)}`,
    })
  }

  if (parsed.color) {
    const needle = parsed.color.toLowerCase()
    const inName = product.name.toLowerCase().includes(needle)
    const inDesc = (product.description ?? "").toLowerCase().includes(needle)
    if (!inName && !inDesc) {
      return { matches: false, highlights: [] }
    }
    highlights.push({ field: "color", label: `Color: ${parsed.color}` })
  }

  if (parsed.keywords.length > 0) {
    let anyKeywordMatched = false
    for (const keyword of parsed.keywords) {
      const field = findKeywordField(product, keyword)
      if (field) {
        anyKeywordMatched = true
        highlights.push({ field, label: `Matches ‘${keyword}’` })
      }
    }
    if (!anyKeywordMatched) {
      return { matches: false, highlights: [] }
    }
  }

  return { matches: true, highlights }
}

/** A search result paired with its highlight tags. */
export interface SearchResult<T extends SearchableProductWithPrice> {
  product: T
  highlights: SearchHighlight[]
}

/**
 * Pure reference implementation of natural-language search over an
 * in-memory list. Filters by `productMatchesParsedSearch`, orders by
 * name ascending, applies the clamped limit, and returns each result
 * with its highlight tags.
 */
export function searchProductsWithHighlights<T extends SearchableProductWithPrice>(
  products: T[],
  parsed: ParsedNaturalLanguageSearch,
  limit: number | null | undefined = DEFAULT_SEARCH_LIMIT
): SearchResult<T>[] {
  if (!parsed.raw) return []
  const max = clampSearchLimit(limit)
  return products
    .map((product) => ({ product, ...productMatchesParsedSearch(product, parsed) }))
    .filter((r) => r.matches)
    .sort((a, b) => a.product.name.localeCompare(b.product.name))
    .slice(0, max)
    .map(({ product, highlights }) => ({ product, highlights }))
}
