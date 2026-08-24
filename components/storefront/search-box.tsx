/**
 * ShopNova - Storefront header search control.
 *
 * A small form that submits a `search` query param to `/products` via GET,
 * so search results are URL-addressable (bookmarkable / shareable) and the
 * search state lives in the URL rather than ephemeral client state.
 *
 * Works on desktop and mobile: collapses to an icon-only button on small
 * screens (the input expands on focus/submit). Uses the existing Input
 * primitive and Tailwind styling conventions.
 */
"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { normalizeSearchQuery } from "@/features/search/search-logic"

export function SearchBox() {
  const router = useRouter()
  const params = useSearchParams()
  // Seed the input from the current URL so the box reflects the active
  // search on the results page (e.g. after a refresh or shared link).
  const [value, setValue] = useState(params.get("search") ?? "")
  const [expanded, setExpanded] = useState(false)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const term = normalizeSearchQuery(value)
    if (term === "") {
      // An empty submit just browses all products.
      router.push("/products")
    } else {
      router.push(`/products?search=${encodeURIComponent(term)}`)
    }
    setExpanded(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={cn(
        "flex items-center",
        // On mobile, only the icon shows until activated.
        expanded ? "w-full sm:w-auto" : "w-auto"
      )}
    >
      <div className="relative flex w-full items-center">
        <Search
          className="pointer-events-none absolute left-2 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <label htmlFor="storefront-search" className="sr-only">
          Search products
        </label>
        <input
          id="storefront-search"
          name="search"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setExpanded(true)}
          placeholder="Search products..."
          aria-label="Search products"
          className={cn(
            "h-9 w-full rounded-lg border border-input bg-transparent pl-8 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            // Collapse to icon-only width on small screens until activated.
            expanded ? "min-w-[10rem] sm:min-w-[14rem]" : "min-w-[8rem] sm:min-w-[14rem]"
          )}
        />
      </div>
    </form>
  )
}
