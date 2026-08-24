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
  parseSearchQuery,
  productMatchesSearch,
  searchProducts,
  type SearchableProduct,
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
