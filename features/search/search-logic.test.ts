/**
 * ShopNova - Storefront product search logic unit tests.
 *
 * Run with: node --test --experimental-strip-types features/search/search-logic.test.ts
 *
 * Covers the pure search contract that the database query
 * (`searchStorefrontProducts` in `lib/db/products.ts`) mirrors:
 *   - query normalization + validation
 *   - matching by product name
 *   - matching by description
 *   - matching by SKU
 *   - matching by category name
 *   - case-insensitive matching
 *   - partial / substring matches
 *   - no results
 *   - archived products are never matched
 *   - empty / invalid query handling
 *   - result ordering (name ascending) and limit clamping
 */
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_QUERY_LENGTH,
  clampSearchLimit,
  getSearchTerm,
  isValidSearchQuery,
  normalizeSearchQuery,
  parseNaturalLanguageQuery,
  parseSearchQuery,
  productMatchesParsedSearch,
  productMatchesSearch,
  searchProducts,
  searchProductsWithHighlights,
  type SearchableProduct,
  type SearchableProductWithPrice,
} from "./search-logic.ts"

// ── Test fixtures ──────────────────────────────

function makeProduct(
  over: Partial<SearchableProduct> & { name: string }
): SearchableProduct {
  return {
    description: null,
    sku: null,
    archived: false,
    category: { name: "Electronics" },
    ...over,
  }
}

function makePricedProduct(
  over: Partial<SearchableProductWithPrice> & { name: string }
): SearchableProductWithPrice {
  return {
    ...makeProduct(over),
    price: 100,
    ...over,
  }
}

const HEADPHONES = makeProduct({
  name: "Wireless Noise-Cancelling Headphones",
  description:
    "Premium over-ear headphones with active noise cancellation and 30-hour battery life.",
  sku: "SN-ELEC-001",
  category: { name: "Electronics" },
})

const MUG = makeProduct({
  name: "Stoneware Coffee Mug",
  description: "A hand-finished stoneware mug with a comfortable handle.",
  sku: "SN-HOME-003",
  category: { name: "Home & Living" },
})

const SNEAKERS = makeProduct({
  name: "Classic Running Sneakers",
  description: "Lightweight, breathable running sneakers with responsive cushioning.",
  sku: "SN-FASH-001",
  category: { name: "Fashion" },
})

const ARCHIVED = makeProduct({
  name: "Discontinued Wireless Headphones",
  description: "An older headphones model no longer sold.",
  sku: "SN-ELEC-OLD",
  archived: true,
  category: { name: "Electronics" },
})

const CATALOG = [HEADPHONES, MUG, SNEAKERS, ARCHIVED]

// Priced catalog for natural-language search tests.
const RED_JACKET = makePricedProduct({
  name: "Cozy Red Winter Jacket",
  description: "A warm, insulated jacket perfect for cold mornings.",
  sku: "SN-FASH-010",
  category: { name: "Fashion" },
  price: 750,
})

const BLUE_JACKET = makePricedProduct({
  name: "Blue Denim Jacket",
  description: "A classic denim jacket with a relaxed fit.",
  sku: "SN-FASH-011",
  category: { name: "Fashion" },
  price: 950,
})

const RED_MUG = makePricedProduct({
  name: "Red Ceramic Mug",
  description: "A bright red mug for your morning coffee.",
  sku: "SN-HOME-010",
  category: { name: "Home & Living" },
  price: 120,
})

// A product priced at exactly R50 — used to verify strict vs inclusive
// price-cap boundaries.
const FIFTY_RAND_ITEM = makePricedProduct({
  name: "Fifty Rand Item",
  description: "A product priced at exactly R50.",
  sku: "SN-TEST-050",
  category: { name: "Home & Living" },
  price: 50,
})

const PRICED_CATALOG = [RED_JACKET, BLUE_JACKET, RED_MUG, FIFTY_RAND_ITEM]

// ── Query normalization + validation ──────────

test("normalizeSearchQuery trims and collapses internal whitespace", () => {
  assert.equal(normalizeSearchQuery("  headphones  "), "headphones")
  assert.equal(normalizeSearchQuery("noise   cancelling"), "noise cancelling")
  assert.equal(normalizeSearchQuery("\t wireless \n headphones "), "wireless headphones")
})

test("normalizeSearchQuery returns empty string for blank/null/undefined input", () => {
  assert.equal(normalizeSearchQuery(""), "")
  assert.equal(normalizeSearchQuery("   "), "")
  assert.equal(normalizeSearchQuery(null), "")
  assert.equal(normalizeSearchQuery(undefined), "")
})

test("isValidSearchQuery rejects empty and over-long queries", () => {
  assert.equal(isValidSearchQuery(""), false)
  assert.equal(isValidSearchQuery(" ".repeat(5)), false)
  assert.equal(isValidSearchQuery("a"), true)
  assert.equal(isValidSearchQuery("headphones"), true)
  assert.equal(isValidSearchQuery("a".repeat(MAX_SEARCH_QUERY_LENGTH)), true)
  assert.equal(
    isValidSearchQuery("a".repeat(MAX_SEARCH_QUERY_LENGTH + 1)),
    false
  )
})

test("parseSearchQuery combines normalization and validation", () => {
  assert.deepEqual(parseSearchQuery("  Headphones  "), {
    query: "Headphones",
    isValid: true,
  })
  assert.deepEqual(parseSearchQuery("   "), { query: "", isValid: false })
})

test("getSearchTerm returns the term for valid input and null otherwise", () => {
  assert.equal(getSearchTerm("  Headphones "), "Headphones")
  assert.equal(getSearchTerm(""), null)
  assert.equal(getSearchTerm("   "), null)
  assert.equal(getSearchTerm(null), null)
  assert.equal(getSearchTerm("a".repeat(MAX_SEARCH_QUERY_LENGTH + 1)), null)
})

// ── Limit clamping ─────────────────────────────

test("clampSearchLimit falls back to the default for falsy/non-positive input", () => {
  assert.equal(clampSearchLimit(0), DEFAULT_SEARCH_LIMIT)
  assert.equal(clampSearchLimit(-5), DEFAULT_SEARCH_LIMIT)
  assert.equal(clampSearchLimit(null), DEFAULT_SEARCH_LIMIT)
  assert.equal(clampSearchLimit(undefined), DEFAULT_SEARCH_LIMIT)
})

test("clampSearchLimit caps oversized requests at the default maximum", () => {
  assert.equal(clampSearchLimit(999), DEFAULT_SEARCH_LIMIT)
  assert.equal(clampSearchLimit(DEFAULT_SEARCH_LIMIT + 1), DEFAULT_SEARCH_LIMIT)
})

test("clampSearchLimit returns the requested value when within range", () => {
  assert.equal(clampSearchLimit(5), 5)
  assert.equal(clampSearchLimit(DEFAULT_SEARCH_LIMIT), DEFAULT_SEARCH_LIMIT)
})

// ── Matching: product name ─────────────────────

test("productMatchesSearch matches by product name", () => {
  assert.equal(productMatchesSearch(HEADPHONES, "Headphones"), true)
  assert.equal(productMatchesSearch(MUG, "Coffee Mug"), true)
})

test("productMatchesSearch matches by partial product name", () => {
  assert.equal(productMatchesSearch(HEADPHONES, "Wireless"), true)
  assert.equal(productMatchesSearch(SNEAKERS, "Running"), true)
})

// ── Matching: description ──────────────────────

test("productMatchesSearch matches by description", () => {
  assert.equal(
    productMatchesSearch(HEADPHONES, "noise cancellation"),
    true
  )
  assert.equal(productMatchesSearch(MUG, "hand-finished"), true)
})

test("productMatchesSearch matches a description substring", () => {
  assert.equal(productMatchesSearch(HEADPHONES, "30-hour battery"), true)
})

// ── Matching: SKU ──────────────────────────────

test("productMatchesSearch matches by SKU", () => {
  assert.equal(productMatchesSearch(HEADPHONES, "SN-ELEC-001"), true)
  assert.equal(productMatchesSearch(MUG, "SN-HOME-003"), true)
})

test("productMatchesSearch matches a partial SKU", () => {
  assert.equal(productMatchesSearch(HEADPHONES, "ELEC"), true)
  assert.equal(productMatchesSearch(SNEAKERS, "FASH-001"), true)
})

// ── Matching: category name ────────────────────

test("productMatchesSearch matches by category name", () => {
  assert.equal(productMatchesSearch(HEADPHONES, "Electronics"), true)
  assert.equal(productMatchesSearch(MUG, "Home & Living"), true)
  assert.equal(productMatchesSearch(SNEAKERS, "Fashion"), true)
})

// ── Case-insensitive matching ──────────────────

test("productMatchesSearch is case-insensitive across all fields", () => {
  assert.equal(productMatchesSearch(HEADPHONES, "headphones"), true)
  assert.equal(productMatchesSearch(HEADPHONES, "WIRELESS"), true)
  assert.equal(productMatchesSearch(HEADPHONES, "sn-elec-001"), true)
  assert.equal(productMatchesSearch(HEADPHONES, "electronics"), true)
  assert.equal(productMatchesSearch(HEADPHONES, "NoIsE CaNcElLaTiOn"), true)
})

// ── No results ─────────────────────────────────

test("productMatchesSearch returns false when nothing matches", () => {
  assert.equal(productMatchesSearch(HEADPHONES, "toaster"), false)
  assert.equal(productMatchesSearch(MUG, "headphones"), false)
  assert.equal(productMatchesSearch(SNEAKERS, "zzz-not-a-match"), false)
})

test("productMatchesSearch returns false for an empty term", () => {
  assert.equal(productMatchesSearch(HEADPHONES, ""), false)
})

// ── Archived products excluded ─────────────────

test("productMatchesSearch never matches an archived product", () => {
  // Even when the term appears in the archived product's name/description/sku.
  assert.equal(productMatchesSearch(ARCHIVED, "Discontinued"), false)
  assert.equal(productMatchesSearch(ARCHIVED, "headphones"), false)
  assert.equal(productMatchesSearch(ARCHIVED, "SN-ELEC-OLD"), false)
  assert.equal(productMatchesSearch(ARCHIVED, "Electronics"), false)
})

// ── searchProducts: filtering, ordering, limits ─

test("searchProducts filters the catalog by the search term", () => {
  const results = searchProducts(CATALOG, "headphones")
  assert.equal(results.length, 1)
  assert.equal(results[0].name, "Wireless Noise-Cancelling Headphones")
})

test("searchProducts matches across multiple fields and products", () => {
  // "Electronics" matches the headphones category; the archived electronics
  // product must NOT appear.
  const results = searchProducts(CATALOG, "Electronics")
  assert.equal(results.length, 1)
  assert.equal(results[0].name, "Wireless Noise-Cancelling Headphones")
})

test("searchProducts excludes archived products", () => {
  const results = searchProducts(CATALOG, "Discontinued")
  assert.equal(results.length, 0)
  // A term matching both an active and an archived product only returns active.
  const headphonesResults = searchProducts(CATALOG, "headphones")
  assert.equal(headphonesResults.length, 1)
  assert.equal(headphonesResults[0].name, "Wireless Noise-Cancelling Headphones")
})

test("searchProducts orders results by name ascending", () => {
  const results = searchProducts(CATALOG, "S") // matches Sneakers, Stoneware...
  // Classic Running Sneakers < Stoneware Coffee Mug alphabetically.
  assert.equal(results[0].name, "Classic Running Sneakers")
  assert.equal(results[1].name, "Stoneware Coffee Mug")
})

test("searchProducts applies the result limit", () => {
  const results = searchProducts(CATALOG, "S", 1)
  assert.equal(results.length, 1)
})

test("searchProducts clamps an oversized limit to the default maximum", () => {
  const results = searchProducts(CATALOG, "S", 999)
  // Catalog has fewer than the default limit, so all matches return.
  assert.ok(results.length <= DEFAULT_SEARCH_LIMIT)
})

test("searchProducts returns an empty array for an empty/invalid query", () => {
  assert.deepEqual(searchProducts(CATALOG, ""), [])
  assert.deepEqual(searchProducts(CATALOG, "   "), [])
  assert.deepEqual(searchProducts(CATALOG, null), [])
  assert.deepEqual(
    searchProducts(CATALOG, "a".repeat(MAX_SEARCH_QUERY_LENGTH + 1)),
    []
  )
})

test("searchProducts returns an empty array when nothing matches", () => {
  assert.deepEqual(searchProducts(CATALOG, "toaster"), [])
})

test("searchProducts handles products with null description/sku/category", () => {
  const sparse = makeProduct({
    name: "Bare Product",
    description: null,
    sku: null,
    category: null,
  })
  assert.equal(productMatchesSearch(sparse, "Bare"), true)
  assert.equal(productMatchesSearch(sparse, "anything-else"), false)
  // A null category must not throw.
  const results = searchProducts([sparse], "Bare")
  assert.equal(results.length, 1)
})

// ── Natural-language query parsing ─────────────

test("parseNaturalLanguageQuery returns empty structured result for blank input", () => {
  assert.deepEqual(parseNaturalLanguageQuery(""), {
    raw: "",
    maxPrice: null,
    inclusive: false,
    color: null,
    keywords: [],
  })
  assert.deepEqual(parseNaturalLanguageQuery(null), {
    raw: "",
    maxPrice: null,
    inclusive: false,
    color: null,
    keywords: [],
  })
})

test("parseNaturalLanguageQuery extracts a price cap with 'under R'", () => {
  const parsed = parseNaturalLanguageQuery("jacket under R800")
  assert.equal(parsed.maxPrice, 800)
  assert.equal(parsed.inclusive, false)
  assert.equal(parsed.color, null)
  assert.deepEqual(parsed.keywords, ["jacket"])
})

test("parseNaturalLanguageQuery treats 'under', 'below', 'less than', 'cheaper than' as strict", () => {
  assert.equal(parseNaturalLanguageQuery("mug under R500").inclusive, false)
  assert.equal(parseNaturalLanguageQuery("mug below R500").inclusive, false)
  assert.equal(parseNaturalLanguageQuery("mug beneath R500").inclusive, false)
  assert.equal(parseNaturalLanguageQuery("mug less than R500").inclusive, false)
  assert.equal(parseNaturalLanguageQuery("mug cheaper than R500").inclusive, false)
})

test("parseNaturalLanguageQuery treats 'up to', 'max', 'or less', 'and under' as inclusive", () => {
  assert.equal(parseNaturalLanguageQuery("mug up to R500").inclusive, true)
  assert.equal(parseNaturalLanguageQuery("mug max R1000").inclusive, true)
  assert.equal(parseNaturalLanguageQuery("mug maximum R1000").inclusive, true)
  assert.equal(parseNaturalLanguageQuery("R500 or less").inclusive, true)
  assert.equal(parseNaturalLanguageQuery("R500 or lower").inclusive, true)
  assert.equal(parseNaturalLanguageQuery("R500 and under").inclusive, true)
})

test("parseNaturalLanguageQuery extracts price caps with varied phrasing", () => {
  assert.equal(parseNaturalLanguageQuery("mug below r500").maxPrice, 500)
  assert.equal(parseNaturalLanguageQuery("mug max R1000").maxPrice, 1000)
  assert.equal(parseNaturalLanguageQuery("mug less than R200").maxPrice, 200)
  assert.equal(parseNaturalLanguageQuery("mug up to R750").maxPrice, 750)
  assert.equal(parseNaturalLanguageQuery("R500 or less").maxPrice, 500)
})

test("parseNaturalLanguageQuery handles decimal price caps", () => {
  assert.equal(parseNaturalLanguageQuery("under R99.99").maxPrice, 99.99)
  assert.equal(parseNaturalLanguageQuery("under R99,99").maxPrice, 99.99)
})

test("parseNaturalLanguageQuery extracts a colour", () => {
  const parsed = parseNaturalLanguageQuery("red jacket")
  assert.equal(parsed.color, "red")
  assert.deepEqual(parsed.keywords, ["jacket"])
  assert.equal(parsed.maxPrice, null)
})

test("parseNaturalLanguageQuery extracts colour, price, and keywords together", () => {
  const parsed = parseNaturalLanguageQuery("cozy red jacket under R800")
  assert.equal(parsed.maxPrice, 800)
  assert.equal(parsed.color, "red")
  assert.deepEqual(parsed.keywords, ["cozy", "jacket"])
})

test("parseNaturalLanguageQuery does not extract a colour from a partial word", () => {
  // "tired" contains "red" but as a substring, not a whole word.
  const parsed = parseNaturalLanguageQuery("tired mug")
  assert.equal(parsed.color, null)
  assert.deepEqual(parsed.keywords, ["tired", "mug"])
})

test("parseNaturalLanguageQuery preserves the raw normalized query", () => {
  const parsed = parseNaturalLanguageQuery("  cozy   jacket under R800  ")
  assert.equal(parsed.raw, "cozy jacket under R800")
})

// ── Parsed-search matching with highlights ─────

test("productMatchesParsedSearch falls back to substring match without price/color", () => {
  const parsed = parseNaturalLanguageQuery("headphones")
  const { matches, highlights } = productMatchesParsedSearch(
    { ...HEADPHONES, price: 100 },
    parsed
  )
  assert.equal(matches, true)
  assert.equal(highlights.length, 1)
  assert.ok(highlights[0].label.includes("headphones"))
})

test("productMatchesParsedSearch applies the price cap as a hard filter", () => {
  const parsed = parseNaturalLanguageQuery("jacket under R800")
  assert.equal(
    productMatchesParsedSearch(RED_JACKET, parsed).matches,
    true
  )
  // Blue jacket is R950 — above the R800 cap.
  assert.equal(
    productMatchesParsedSearch(BLUE_JACKET, parsed).matches,
    false
  )
})

test("productMatchesParsedSearch 'under' is strict: a product at exactly the cap does NOT match", () => {
  const parsed = parseNaturalLanguageQuery("under R50")
  assert.equal(parsed.inclusive, false)
  // FIFTY_RAND_ITEM is priced at exactly R50 — must NOT match "under R50".
  assert.equal(
    productMatchesParsedSearch(FIFTY_RAND_ITEM, parsed).matches,
    false
  )
  // RED_MUG at R120 is above the cap — must NOT match.
  assert.equal(productMatchesParsedSearch(RED_MUG, parsed).matches, false)
})

test("productMatchesParsedSearch 'up to' is inclusive: a product at exactly the cap DOES match", () => {
  const parsed = parseNaturalLanguageQuery("up to R50")
  assert.equal(parsed.inclusive, true)
  // FIFTY_RAND_ITEM is priced at exactly R50 — MUST match "up to R50".
  assert.equal(
    productMatchesParsedSearch(FIFTY_RAND_ITEM, parsed).matches,
    true
  )
  // RED_MUG at R120 is above the cap — must NOT match.
  assert.equal(productMatchesParsedSearch(RED_MUG, parsed).matches, false)
})

test("productMatchesParsedSearch 'R50 or less' is inclusive at the boundary", () => {
  const parsed = parseNaturalLanguageQuery("R50 or less")
  assert.equal(parsed.inclusive, true)
  assert.equal(
    productMatchesParsedSearch(FIFTY_RAND_ITEM, parsed).matches,
    true
  )
})

test("productMatchesParsedSearch 'below' is strict at the boundary", () => {
  const parsed = parseNaturalLanguageQuery("below R50")
  assert.equal(parsed.inclusive, false)
  assert.equal(
    productMatchesParsedSearch(FIFTY_RAND_ITEM, parsed).matches,
    false
  )
})

test("productMatchesParsedSearch adds a price highlight for in-budget products", () => {
  const parsed = parseNaturalLanguageQuery("jacket under R800")
  const { highlights } = productMatchesParsedSearch(RED_JACKET, parsed)
  assert.ok(highlights.some((h) => h.field === "price" && h.label.includes("800")))
})

test("productMatchesParsedSearch applies colour as a hard filter on name/description", () => {
  const parsed = parseNaturalLanguageQuery("red mug")
  assert.equal(productMatchesParsedSearch(RED_MUG, parsed).matches, true)
  // Blue jacket does not contain "red".
  assert.equal(productMatchesParsedSearch(BLUE_JACKET, parsed).matches, false)
})

test("productMatchesParsedSearch adds a colour highlight", () => {
  const parsed = parseNaturalLanguageQuery("red mug")
  const { highlights } = productMatchesParsedSearch(RED_MUG, parsed)
  assert.ok(highlights.some((h) => h.field === "color" && h.label.includes("red")))
})

test("productMatchesParsedSearch uses OR semantics for keywords", () => {
  const parsed = parseNaturalLanguageQuery("cozy jacket under R800")
  // Red jacket matches "jacket" (and is under R800) even though it is not "cozy".
  const result = productMatchesParsedSearch(RED_JACKET, parsed)
  assert.equal(result.matches, true)
  assert.ok(result.highlights.some((h) => h.label.includes("jacket")))
})

test("productMatchesParsedSearch never matches archived products", () => {
  const archived = makePricedProduct({
    name: "Red Archived Jacket",
    description: "Old stock.",
    sku: "SN-OLD",
    category: { name: "Fashion" },
    price: 100,
    archived: true,
  })
  const parsed = parseNaturalLanguageQuery("jacket under R800")
  assert.equal(productMatchesParsedSearch(archived, parsed).matches, false)
})

test("productMatchesParsedSearch matches on price cap alone with no keywords", () => {
  const parsed = parseNaturalLanguageQuery("under R200")
  // Red mug is R120 — under R200.
  assert.equal(productMatchesParsedSearch(RED_MUG, parsed).matches, true)
  // Red jacket is R750 — above R200.
  assert.equal(productMatchesParsedSearch(RED_JACKET, parsed).matches, false)
})

// ── searchProductsWithHighlights ───────────────

test("searchProductsWithHighlights filters, orders, and returns highlight tags", () => {
  const parsed = parseNaturalLanguageQuery("jacket under R800")
  const results = searchProductsWithHighlights(PRICED_CATALOG, parsed)
  // Only the red jacket (R750) matches "jacket" and is under R800.
  assert.equal(results.length, 1)
  assert.equal(results[0].product.name, "Cozy Red Winter Jacket")
  assert.ok(results[0].highlights.length > 0)
})

test("searchProductsWithHighlights returns empty for a blank parsed query", () => {
  const parsed = parseNaturalLanguageQuery("")
  assert.deepEqual(searchProductsWithHighlights(PRICED_CATALOG, parsed), [])
})

test("searchProductsWithHighlights applies the result limit", () => {
  const parsed = parseNaturalLanguageQuery("red")
  const results = searchProductsWithHighlights(PRICED_CATALOG, parsed, 1)
  assert.equal(results.length, 1)
})
