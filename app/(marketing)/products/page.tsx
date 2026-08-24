import { Container } from "@/components/layout/container"
import { ProductCard } from "@/components/storefront/product-card"
import { listStorefrontProducts, searchStorefrontProducts } from "@/lib/db"
import { getSearchTerm } from "@/features/search/search-logic"

export const dynamic = "force-dynamic"

interface ProductsPageProps {
  searchParams: Promise<{ search?: string | string[] }>
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { search } = await searchParams
  // Normalize the query param (may be a string or an array of strings).
  const rawSearch = Array.isArray(search) ? search[0] : search
  const term = getSearchTerm(rawSearch)
  const isSearching = term !== null

  // When a valid search query is present, run the search; otherwise browse
  // all products. Search is performed server-side in PostgreSQL — the full
  // catalog is never shipped to the browser.
  const products = isSearching
    ? await searchStorefrontProducts(term)
    : await listStorefrontProducts()

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
                  &ldquo;{term}&rdquo;
                </span>
                {products.length === 0 && " — no matches found"}
              </>
            ) : (
              "Browse our full collection of products."
            )}
          </p>
        </div>
        {products.length === 0 ? (
          <div className="rounded-lg border p-12 text-center text-muted-foreground">
            <p>
              {isSearching
                ? "No products matched your search. Try a different keyword."
                : "No products available yet. Check back soon."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </Container>
    </div>
  )
}
