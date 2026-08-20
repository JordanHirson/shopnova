# ShopNova — Project Architecture

## Folder Structure

```
app/              # Next.js App Router pages and API routes
components/       # Shared React components
  ui/             # shadcn/ui Base UI primitives (button, input, etc.)
  layout/         # Layout components (topbar, sidebar, container, etc.)
  storefront/     # Storefront-specific components (product-card, etc.)
features/         # Feature-specific modules (auth, products, cart, etc.)
lib/              # Utility functions, clients (prisma)
lib/db/           # Database helpers and Prisma client
lib/validations/  # Zod validation schemas
hooks/            # Custom React hooks
types/            # TypeScript type definitions
prisma/           # Prisma schema and seed
public/           # Static assets
scripts/          # Utility scripts (e.g. zip-project)
```

## Key Decisions

- **No `src/` directory.** All code at root for simplicity.
- **Next.js App Router** for routing and server components.
- **React + TypeScript** throughout.
- **shadcn/ui Base UI** for component primitives. Custom components built on top.
- **Prisma 7** for type-safe database access. Schema in `prisma/schema.prisma`.
- **PostgreSQL 18** with **pgvector** as the database.
- **Clerk** for authentication.
- **React Hook Form + Zod** for form validation. No Formik.
- **TanStack Query** is installed but not currently used in the application.
- **MVP scope.** Build only what's needed for a working product.

## Cart Architecture (Sprint 3, Part 1)

- **Storage:** Server-side cart behind a `CartStore` interface (`features/cart/cart-store.ts`). Redis is NOT currently configured — the dev build uses an in-memory store (`MemoryCartStore`) that survives page navigation while the dev server runs. A `RedisCartStore` can be added later by setting `REDIS_URL` and swapping the singleton initializer; no cart business logic, actions, or UI changes are needed.
- **Shopper identity:** `features/cart/session.ts` resolves a shopper id per request — `user:<clerkUserId>` for signed-in shoppers, or `anon:<uuid>` stored in an httpOnly cookie for anonymous shoppers. No Customer database records are created by cart activity; customers are only created during checkout.
- **Price rule:** The client is never authoritative for price. Cart lines store a display snapshot (`unitPrice`) captured from PostgreSQL at add-to-cart time. Checkout re-reads authoritative prices from the database before creating an order.
- **Inventory:** The cart checks the `Inventory` model to prevent obviously invalid quantities (capping at available stock). Authoritative inventory validation happens during checkout; adding to cart does not reserve inventory.
- **Server actions:** All cart mutations run through server actions in `features/cart/actions.ts` (`addToCartAction`, `updateCartItemQuantityAction`, `removeCartItemAction`, `clearCartAction`, `getCartAction`).
- **Client bridge:** `CartProvider`/`useCart` (`features/cart/cart-context.tsx`) keeps the header badge and cart page in sync without turning the marketing layout into a client component.
- **Tests:** Pure cart logic is unit tested with Node's native test runner (`node --test --experimental-strip-types`). Run with `npm test`.
- **What remains:** Stripe + PayFast payment integration is still pending.

## Checkout & Order Architecture (Sprint 3, Part 2)

- **Routes:** `/checkout` (requires a non-empty cart) and `/checkout/success?orderNumber=...` (confirmation).
- **Validation:** `lib/validations/checkout.ts` defines the Zod schema used by React Hook Form on the client and re-validated on the server before any checkout work. Clerk users get contact info prefilled (`useUser`); anonymous shoppers can complete checkout without signing in.
- **Authoritative pricing:** `features/checkout/actions.ts` `getCheckoutSummaryAction` re-reads product prices/inventory from PostgreSQL so the displayed order summary matches exactly what will be charged.
- **Order creation:** Order creation now happens ONLY after a server-verified payment notification, atomically inside `lib/db/payments.ts` `completePaidIntent` (see Payment Architecture below). The previous `createOrder`/`placeOrderAction` path was removed.
- **Order number:** `generateOrderNumber` in `features/checkout/checkout-logic.ts` produces a customer-facing `SN-YYYYMMDD-XXXXXX` number — the database `id` (uuid) is never exposed.
- **VAT & shipping:** Pure functions in `features/checkout/checkout-logic.ts` — 15% South African VAT and a deterministic MVP shipping rule (free ≥ $50, flat $5 below). Shipping is separated from the UI behind a `ShippingProvider` seam so a courier API can replace it later.
- **Tests:** 17 checkout unit tests in `features/checkout/checkout-logic.test.ts` (VAT, shipping, subtotal, total, quantity validation, insufficient inventory, order number format/uniqueness).

## Payment Architecture (Sprint 3, Part 3)

- **Provider abstraction:** `features/payment/types.ts` defines a `PaymentProvider` interface (`isConfigured`, `createSession`, `handleWebhook`). Checkout business logic never imports a specific gateway; it goes through `features/payment/provider-registry.ts` which only registers gateways whose server-side credentials are present. Additional gateways (Yoco, Stitch) can drop in behind the same interface.
- **Providers:**
  - **Stripe** (`features/payment/stripe.ts`) — hosted Checkout Sessions via direct Stripe API calls (no `stripe` npm dependency). Webhook signature verified with HMAC-SHA256 + `STRIPE_WEBHOOK_SECRET` and `timingSafeEqual`. Implemented and unit-tested against real signature math; NOT marked production-ready because it has not been exercised against the live Stripe API with real credentials.
  - **PayFast** (`features/payment/payfast.ts`) — hosted PayFast form (sandbox/production endpoint selected by `PAYFAST_TEST_MODE`). ITN callback verified with MD5 over sorted POST fields + `PAYFAST_PASSPHRASE`. Implemented and unit-tested against real signature math; NOT marked production-ready because it has not been exercised against the live PayFast sandbox with real credentials.
  - **Test** (`features/payment/test.ts`) — mock gateway for local dev and automated tests. Hosted "payment page" is `/checkout/test-pay`; the completion callback is HMAC-signed with `TEST_PAYMENT_SECRET` and still passes server-side verification. Only registered outside production (`NODE_ENV !== "production"`).
- **Provider selection:** `selectProviderForCountry` routes South Africa → PayFast (guidebook default) and international → Stripe. When the selected real gateway is not configured (local dev without credentials), the flow falls back to the Test provider.
- **Intent-based flow (no order until paid):**
  1. `startCheckoutPaymentAction` (`features/payment/actions.ts`) validates the form, creates a PENDING `CheckoutIntent` with an authoritative server-computed amount (re-read from PostgreSQL), selects the provider server-side, creates the hosted-payment session, and returns the redirect URL. No `Order` is created and no inventory is touched at this stage.
  2. The shopper is redirected to the gateway's hosted payment UI (raw card data never touches ShopNova).
  3. The gateway posts a signed webhook/ITN to `/api/webhooks/{provider}`.
  4. `features/payment/webhook-handler.ts` → provider `handleWebhook` verifies the signature server-side and throws on failure (the browser is never trusted).
  5. `lib/db/payments.ts` `completePaidIntent` runs the verified notification atomically: claims the intent with a `status: PENDING` + `completedPayloadKey: null` guarded `updateMany` (idempotency), re-reads authoritative products + inventory, validates quantities, recalculates prices, finds-or-creates the Customer, creates the `Order` as `CONFIRMED` (paid), creates `OrderItem` price snapshots, decrements inventory with a quantity guard, and records a `SUCCEEDED` `Payment`. The cart is cleared only after the transaction commits.
- **Security guarantees:**
  - An order is only created (and only marked paid) after a server-verified provider notification. Browser-supplied success is never trusted.
  - Payment amounts are derived from authoritative server/DB values, never client-supplied totals. The gateway's verified charge must exactly match the server-computed intent amount (cents) or the notification is rejected as `amount-mismatch`.
  - Duplicate webhook deliveries are idempotent: the unique `completedPayloadKey` + guarded status transition prevent double order creation or double inventory decrement.
  - Raw card numbers, CVV, etc. never reach ShopNova servers (hosted Stripe Checkout / PayFast form / mock page).
- **Webhook routes:** `/api/webhooks/stripe`, `/api/webhooks/payfast`, `/api/webhooks/test` — thin route handlers delegating to the shared `handleProviderWebhook`. HTTP status codes: 200 (processed/duplicate/failed/ignored), 400 (signature failure / provider not configured / amount mismatch), 404 (intent not found), 500 (unexpected error).
- **Shipping seam:** `features/shipping/shipping-provider.ts` introduces a `ShippingProvider` interface (`quote`). The default `MvpShippingProvider` keeps the deterministic free-above-$50 / flat-$5 rule from checkout-logic. Live courier integrations (Bob Go, Aramex, PUDO, Courier Guy) can later implement the same interface and be registered without touching checkout business logic or the UI.
- **Tests:** 11 payment-logic tests (`features/payment/payment-logic.test.ts`) + 15 webhook verification tests (`features/payment/payment-webhook.test.ts`) using the REAL provider adapter code with mock credentials. The test runner shims the `server-only` marker package via `scripts/test-register.mjs` + `scripts/test-loader.mjs` so provider modules can be imported outside a React server context.

## Customer Accounts & Order History (Sprint 4)

- **Clerk ↔ Customer link:** A nullable, unique `Customer.clerkUserId` column (additive schema change) associates an authenticated Clerk user with their existing Customer row. The link is set during checkout inside `completePaidIntent` when the shopper is signed in (`shopperId` starts with `user:<clerkUserId>`). Guest checkouts leave `clerkUserId` null. Clerk remains the authentication source of truth; no second auth system is introduced.
- **Customer resolution:** `lib/db/customers.ts` `getCustomerForClerkUser(clerkUserId)` resolves the authenticated Clerk user to their Customer row (within the default store). Returns null for a brand-new account that has never completed a signed-in checkout.
- **Authorized order queries:** `lib/db/orders.ts` adds `getOrdersForCustomer(customerId)` and `getOrderForCustomer(customerId, orderNumber)`. Both scope every query to the authenticated customer's id — this is the authorization boundary. A foreign order number returns null (identical to a missing one), so a customer can neither view nor confirm another customer's order by manipulating the URL.
- **Pure auth helpers:** `features/account/account-logic.ts` provides `clerkUserIdFromShopperId`, `isOrderOwnedByCustomer`, `assertOrderOwnedByCustomer`, and `buildDisplayName` — side-effect-free functions unit-tested with Node's native test runner.
- **Routes:** `/account` (overview with Clerk name/email + order count), `/account/orders` (order history table with empty-state), `/account/orders/[orderNumber]` (order detail: items, line totals, subtotal/VAT/shipping/total, shipping/contact info, payment summary). All three redirect unauthenticated users to `/sign-in?redirect_url=...` via in-page `redirect()`.
- **Auth strategy:** In-page `redirect()` is used instead of middleware `auth.protect()` because Clerk v7 deprecates `createRouteMatcher` and `auth.protect()` returns 404 (instead of redirecting) under Next.js 16. The in-page check is the recommended resource-based approach per Clerk's migration guide.
- **Navigation:** `components/storefront/account-button.tsx` shows "Sign in" for anonymous shoppers and an Account link + Clerk `UserButton` for signed-in shoppers. Added to the marketing header alongside the cart button.
- **Existing data:** The schema change is additive. Existing customers/orders are preserved. Existing guest-checkout customers have `clerkUserId = null` and their orders are not accessible through the account area (by design — they were placed as a guest).
- **Tests:** 15 account-logic tests (`features/account/account-logic.test.ts`) covering Clerk/customer association, order ownership (own / foreign / guest / missing), `assertOrderOwnedByCustomer` throw behavior, and display-name fallbacks. Total test suite: 71 tests.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run db:seed` | Seed demo data |
| `npx prisma db push` | Sync schema to DB |
| `npx prisma studio` | Open DB browser |
| `npx prisma validate` | Validate Prisma schema |
| `npx prisma generate` | Generate Prisma Client |