import { Container } from "@/components/layout/container"
import { ProductCard } from "@/components/storefront/product-card"
import { listStorefrontProducts, searchStorefrontProductsParsed } from "@/lib/db"
import {
  parseNaturalLanguageQuery,
  productMatchesParsedSearch,
  type SearchHighlight,
} from "@/features/search/search-logic"

export const dynamic = "force-dynamic"

interface ProductsPageProps {
  searchParams: Promise<{ search?: string | string[] }>
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { search } = await searchParams
  // Normalize the query param (may be a string or an array of strings).
  const rawSearch = Array.isArray(search) ? search[0] : search
  const parsed = parseNaturalLanguageQuery(rawSearch)
  const isSearching = parsed.raw !== ""

  // When a valid search query is present, run the parsed natural-language
  // search; otherwise browse all products. Search is performed server-side
  // in PostgreSQL — the full catalog is never shipped to the browser.
  const products = isSearching
    ? await searchStorefrontProductsParsed(parsed)
    : await listStorefrontProducts()

  // Compute highlight tags explaining why each product matched the parsed
  // query. Browse mode has no highlights.
  const results = isSearching
    ? products.map((product) => {
        const { highlights } = productMatchesParsedSearch(
          {
            name: product.name,
            description: product.description,
            sku: product.sku,
            archived: product.archived,
            category: product.category ? { name: product.category.name } : null,
            price: Number(product.price),
          },
          parsed
        )
        return { product, highlights: highlights as SearchHighlight[] }
      })
    : products.map((product) => ({ product, highlights: [] as SearchHighlight[] }))

  // Build a compact, human-readable summary of the parsed filters for the
  // results header (e.g. "jacket · under R800.00 · color: red").
  const filterSummary = isSearching
    ? [
        parsed.keywords.length > 0 ? parsed.keywords.join(" ") : null,
        parsed.maxPrice !== null
          ? parsed.inclusive
            ? `up to R${parsed.maxPrice.toFixed(2)}`
            : `under R${parsed.maxPrice.toFixed(2)}`
          : null,
        parsed.color ? `color: ${parsed.color}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {isSearching ? "Search Results" : "All Products"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isSearching ? (
              <>
                Showing results for{" "}
                <span className="font-medium text-foreground">
                  &ldquo;{parsed.raw}&rdquo;
                </span>
                {filterSummary && (
                  <span className="text-muted-foreground">
                    {" "}
                    — {filterSummary}
                  </span>
                )}
                {results.length === 0 && " — no matches found"}
              </>
            ) : (
              "Browse our full collection of products."
            )}
          </p>
        </div>
        {results.length === 0 ? (
          <div className="rounded-lg border p-12 text-center text-muted-foreground">
            <p>
              {isSearching
                ? "No products matched your search. Try a different keyword or price range."
                : "No products available yet. Check back soon."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map(({ product, highlights }) => (
              <ProductCard
                key={product.id}
                product={product}
                highlights={highlights}
              />
            ))}
          </div>
        )}
      </Container>
    </div>
  )
}
