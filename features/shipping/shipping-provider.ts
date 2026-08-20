/**
 * ShopNova - Shipping provider seam.
 *
 * The guidebook specifies live courier quotes (Bob Go, Aramex, PUDO,
 * Courier Guy) for the shipping step. Live courier APIs are NOT part of
 * this task, so checkout keeps its deterministic MVP calculation. This
 * module introduces the abstraction the courier integrations can later
 * drop in behind without touching checkout business logic or the UI.
 *
 * The deterministic rule (free >= $50, flat $5 below) is kept exactly as
 * it was in Sprint 3 Part 2 (features/checkout/checkout-logic.ts) so no
 * existing behavior changes.
 */
import { calculateShipping } from "@/features/checkout/checkout-logic"

/** Destination info that a courier quote API will need. */
export interface ShippingDestination {
  country: string
  province: string
  city: string
  postalCode: string
}

/** A shipping option quoted by a provider. */
export interface ShippingQuote {
  provider: string
  method: string
  /** Delivery estimate in business days (null = unknown). */
  estimateDays: number | null
  rate: number
}

/** Contract every shipping provider (live or deterministic) implements. */
export interface ShippingProvider {
  readonly id: string
  quote(subtotal: number, destination: ShippingDestination): Promise<ShippingQuote[]>
}

/**
 * Default MVP provider: keeps the deterministic free-above-$50 / flat-$5
 * rule from checkout-logic. Live providers later implement the same
 * interface and are registered by ID, e.g. "bobgo", "aramex", "pudo",
 * "courier-guy".
 */
export class MvpShippingProvider implements ShippingProvider {
  readonly id = "mvp"

  async quote(
    subtotal: number,
    _destination: ShippingDestination
  ): Promise<ShippingQuote[]> {
    const rate = calculateShipping(subtotal)
    return [
      {
        provider: this.id,
        method: rate === 0 ? "Free shipping" : "Standard shipping",
        estimateDays: rate === 0 ? null : 5,
        rate,
      },
    ]
  }
}

/**
 * Returns the active shipping provider. Today this is the deterministic
 * MVP provider; a courier API can replace it by adding a provider registry
 * keyed on e.g. SHIPPING_PROVIDER env var without touching checkout.
 */
export function getShippingProvider(): ShippingProvider {
  return new MvpShippingProvider()
}