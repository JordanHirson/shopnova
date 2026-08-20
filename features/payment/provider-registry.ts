/**
 * ShopNova - Payment provider registry.
 *
 * Keeps gateway implementations decoupled from checkout business logic.
 * Adapters are lazily constructed with their server-side configuration
 * so that an unconfigured gateway (no valid secret keys) is simply not
 * registered and can never be selected by a client.
 */
import "server-only"

import type { PaymentProvider, PaymentProviderId } from "./types"
import { StripeProvider } from "./stripe"
import { PayFastProvider } from "./payfast"
import { TestProvider } from "./test"

/**
 * Builds the provider list available for the current server environment.
 *
 * The mock TestProvider is only registered outside production so a real
 * deployment can never accidentally route a checkout through the fake
 * gateway. In production, only Stripe / PayFast (when their server-side
 * credentials are present) are selectable.
 */
export function getConfiguredProviders(): PaymentProvider[] {
  const providers: PaymentProvider[] = [new StripeProvider(), new PayFastProvider()]
  if (process.env.NODE_ENV !== "production") {
    providers.push(new TestProvider())
  }
  return providers
}

/**
 * Returns the registered provider for a gateway id, or null when the
 * provider is unsupported or its server-side configuration is missing.
 */
export async function getProvider(
  id: PaymentProviderId
): Promise<PaymentProvider | null> {
  const provider = getConfiguredProviders().find((p) => p.id === id)
  return provider?.isConfigured() ? provider : null
}