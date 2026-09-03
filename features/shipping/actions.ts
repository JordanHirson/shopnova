/**
 * ShopNova - Shipping server actions.
 *
 * Exposes the server-side shipping-provider abstraction to the checkout
 * flow. The client supplies only the destination (address); the server
 * computes the authoritative subtotal from PostgreSQL and obtains the
 * quote through the provider registry. The client is never authoritative
 * for the shipping rate, provider, or quote.
 */
"use server"

import { loadAuthoritativeCheckoutLines } from "@/features/checkout/checkout-lines"
import { getShippingQuotes, getShippingOrigin } from "./provider-registry"
import type { ShippingQuote } from "./shipping-provider"
import {
  buildQuoteRequest,
  isShippingDestinationComplete,
  selectCheapestQuote,
  shippingAddressFromDestination,
  type CheckoutDestination,
} from "./shipping-logic"
import { ShippingQuoteError } from "./provider-registry"

/** Result of requesting shipping quotes for a destination. */
export interface ShippingQuoteResult {
  /** Available quotes (cheapest first is not guaranteed; use `selected`). */
  quotes: ShippingQuote[]
  /** The cheapest valid quote the checkout will use, or null when none. */
  selected: ShippingQuote | null
  /** User-facing error when no quote could be obtained. */
  error?: string
}

/**
 * Returns the authoritative shipping quotes for the current shopper's cart
 * and the supplied destination. The subtotal is recomputed server-side from
 * PostgreSQL; the destination is the only client-supplied input and it is
 * validated before any quote is requested.
 */
export async function getShippingQuoteAction(
  destination: Partial<CheckoutDestination>
): Promise<ShippingQuoteResult | null> {
  const lines = await loadAuthoritativeCheckoutLines()
  if (!lines) return null

  if (!isShippingDestinationComplete(destination)) {
    return {
      quotes: [],
      selected: null,
      error: "A complete shipping address is required to get a quote.",
    }
  }

  const currency = "ZAR"
  try {
    const quotes = await getShippingQuotes(
      buildQuoteRequest({
        origin: getShippingOrigin(),
        destination: shippingAddressFromDestination(destination),
        subtotal: lines.subtotal,
        currency,
        itemCount: lines.itemCount,
        lines: lines.items.map((item) => ({
          quantity: item.quantity,
          weightGrams: item.weightGrams,
          lengthCm: item.lengthCm,
          widthCm: item.widthCm,
          heightCm: item.heightCm,
        })),
      })
    )
    return {
      quotes,
      selected: selectCheapestQuote(quotes, currency),
    }
  } catch (err) {
    if (err instanceof ShippingQuoteError) {
      return { quotes: [], selected: null, error: err.message }
    }
    return {
      quotes: [],
      selected: null,
      error: "We could not get a shipping quote for this destination.",
    }
  }
}
