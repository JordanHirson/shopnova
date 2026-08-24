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
- **Archived products:** `getCartAction` re-checks every cart line against the current product archive status. An archived line is shown as unavailable, excluded from the subtotal and header item count, and rejected at checkout (see Final MVP Audit below).
- **Tests:** Pure cart logic is unit tested with Node's native test runner (`node --test --experimental-strip-types`). Run with `npm test`.

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
  - Payment amounts are derived from authoritative server/DB values, never client-supplied totals. The gateway's verified charge must exactly match the server-computed intent amount (cents) **and** currency, or the notification is rejected as `amount-mismatch`.
  - The mock Test gateway completion path (`completeTestPaymentAction`, `/checkout/test-pay`) is refused unless the server is outside production, the intent's provider is `test`, and the intent belongs to the calling shopper.
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

## Admin Dashboard & Store Management (Sprint 5)

- **Authorization approach:** An admin is a Clerk user whose `privateMetadata.role === "admin"`. `privateMetadata` is only readable server-side via the Clerk Backend API (`currentUser()`), so a customer can never learn or forge admin status in the browser, and users cannot set their own privateMetadata. No second auth system is introduced — Clerk remains the source of truth. Grant/revoke the role with `npm run set-admin -- <clerkUserId> [--remove]` (`scripts/set-admin.ts`, uses `CLERK_SECRET_KEY`) or via the Clerk Dashboard.
- **Server-side enforcement:** `lib/auth/admin.ts` provides `requireAdmin()` (throws `UnauthenticatedError`/`AdminRequiredError`, used in every admin server action), `requireAdminOrRedirect()` (redirects to sign-in / `/dashboard/unauthorized`, used at the top of every admin page), and `getAdminContext()` (non-throwing, used for the storefront header link). Pure helpers + errors live in `features/admin/admin-logic.ts` (`isAdminRole`, `assertAdminRole`, `roleFromMetadata`, order-status rules) so they can be unit-tested without Clerk credentials.
- **Middleware:** A lightweight authentication gate redirects unauthenticated `/dashboard(.*)` requests to `/sign-in?redirect_url=/dashboard`. Role *authorization* is NOT done in middleware because `privateMetadata` is not present in the JWT — it happens in-page and in server actions. This matches the resource-based auth pattern already used by `/account` (Clerk v7 + Next.js 16 deprecates `auth.protect()`).
- **Schema change (additive):** `Product.archived Boolean @default(false)` enables safe soft-delete. Products are referenced by `OrderItem` with `onDelete: Restrict`, so a hard delete would fail once a product has been ordered. Archiving hides a product from the storefront and cart while keeping historical order records intact. Storefront queries (`getProductBySlug`, `listStorefrontProducts`, `listFeaturedProducts`, `listProductsByCategory`, `getCartProduct`) now filter `archived: false`; the admin `listProducts` still shows archived products (with a badge) so they can be inspected or restored.
- **Dashboard (`/dashboard`):** KPI overview — total/active/archived products, categories, customers, orders, pending orders, low-stock count, and the 5 most recent orders. KPI cards link to the relevant management page.
- **Products (`/dashboard/products`):** List with stock + archived status, create/edit via dialog (name, slug, description, price, compare-at price, SKU, category), archive (soft-delete) with confirmation, and restore. All actions are admin-authorized server actions that revalidate storefront paths.
- **Categories (`/dashboard/categories`):** List with product counts, create/edit/delete. `deleteCategory` pre-checks the product count and throws a clear error when products still reference the category (the `onDelete: Restrict` FK would otherwise surface as a raw error), so the admin is told to reassign/archive products first.
- **Inventory (`/dashboard/inventory`):** List stock levels + low-stock thresholds with low-stock badges, and update quantity and/or threshold via an admin server action (`updateInventoryAction`) validated with a Zod schema (`lib/validations/inventory.ts`). Admin updates do not interfere with the transactional checkout inventory decrement in `completePaidIntent` — they simply set absolute levels.
- **Orders (`/dashboard/orders` + `/dashboard/orders/[orderNumber]`):** List with customer + item count + total; detail with items, line totals, subtotal/VAT/shipping/total, customer + shipping info, and a read-only payment summary. Admin can update the fulfillment status via `updateOrderStatusAction`. **Payment security:** only fulfillment statuses are admin-settable (`CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`); `PENDING` and `REFUNDED` are excluded so an admin UI action can never falsely mark an order as paid or refunded — payment state stays driven by verified gateway webhooks.
- **Customers (`/dashboard/customers` + `/dashboard/customers/[customerId]`):** List with order count + join date; detail with contact summary and order history (linking to the admin order detail). No auth identifiers (`clerkUserId`) or raw addresses are exposed.
- **Navigation:** The dashboard uses its own sidebar/topbar layout (`(dashboard)` route group) so admin nav never clutters the storefront. An `AdminLink` server component in the storefront header renders an "Admin" link only for admins (UI convenience only — not the security boundary). The dashboard topbar has a "View store" link back to the storefront.
- **Existing data:** The schema change is additive and safe. Existing products default to `archived = false`. No demo data, orders, or payment records were modified.
- **Tests:** 12 admin-logic tests (`features/admin/admin-logic.test.ts`) covering role matching (exact, case-sensitive), metadata extraction, `assertAdminRole` throw behavior, and order-status rules (PENDING/REFUNDED rejected, invalid inputs rejected). Total test suite: 83 tests.
- **Verification:** `npx prisma validate`, `npx prisma db push`, `npm test` (83 tests), `npx tsc --noEmit`, `npx eslint .` (0 errors), `npx next build`, manual dev-server route check (unauthenticated `/dashboard*` → 307 redirect to sign-in; storefront home/products → 200).

## Product Search (Sprint 6)

- **Pure search contract:** `features/search/search-logic.ts` is the single source of truth for the search behavior — query normalization (trim + collapse whitespace), validation (non-empty, ≤ 100 chars), the list of searchable fields, case-insensitive substring match semantics, archived-product exclusion, name-ascending ordering, and result-limit clamping (default/max 24). `productMatchesSearch` and `searchProducts` are pure reference implementations of this contract so it can be unit-tested without a database.
- **Database query:** `lib/db/products.ts` `searchStorefrontProducts` mirrors the pure contract using Prisma `contains` + `mode: "insensitive"` (PostgreSQL `ILIKE` with `%term%`) across product `name`, `description`, `sku`, and related category `name` (via a relation filter). It always filters `archived: false`, orders by name ascending, and clamps the result count. Filtering is performed by PostgreSQL — the full catalog is never loaded into the application. Queries are parameterized (no raw SQL, no SQL injection surface).
- **URL-addressable results:** The `/products` page reads a `search` query param. A valid query runs `searchStorefrontProducts`; a missing/blank/invalid query falls back to browsing all products (`listStorefrontProducts`). Results are bookmarkable/shareable and the search state lives in the URL, not ephemeral client state. The page shows a "Search Results" header with the query, a no-matches empty state, and reuses the existing `ProductCard` grid.
- **Search UI:** `components/storefront/search-box.tsx` is a small client form in the storefront header that submits a GET request to `/products?search=...` via `next/navigation` `router.push`. It has an accessible label (`sr-only` + `aria-label`), `role="search"`, seeds its input from the current URL (so it reflects the active search on the results page), and works on desktop and mobile. It is wrapped in `<Suspense>` in the marketing layout because it uses `useSearchParams`. Header nav links are hidden on mobile to make room for the search control.
- **Security:** Search is public storefront functionality. Archived products are never returned. Only storefront-relevant fields are selected (no admin-only or sensitive fields). Input is normalized and length-clamped server-side. No raw SQL.
- **Tests:** 28 search-logic unit tests (`features/search/search-logic.test.ts`) covering name/description/sku/category matching, case-insensitive matching, partial/substring matches, no results, archived-product exclusion, empty/invalid/over-long query handling, result ordering (name ascending), and limit clamping.
- **Future optimization (deliberately deferred):** PostgreSQL full-text search (`tsvector`/`tsquery` with `websearch_to_tsquery` and GIN indexes), trigram indexes (`pg_trgm`) for fuzzy/typo-tolerant matching, and pgvector semantic/vector search. Not needed for the current catalog size — the MVP uses simple `ILIKE` substring matching which is fast and sufficient.

## Final MVP Audit (Sprint 7)

A full audit of the implementation against the MVP requirements in `GUIDEBOOK.md`, covering the customer journey, admin journey, security boundaries, data integrity, payment safety, responsive UX, and the test suite. Findings and fixes:

- **Forgeable paid order via the mock Test gateway (security, high).** `completeTestPaymentAction` built a "verified" notification from the intent's own amount with no environment gate, no provider check, and no ownership check — and `/checkout/test-pay` is compiled into every build. A client could therefore start a real Stripe/PayFast checkout and complete it for free, or complete/decline another shopper's intent. Fixed: both the action and the page now require `NODE_ENV !== "production"`, `intent.provider === "test"`, and `intent.shopperId === ` the current shopper (pure `isTestPaymentAllowed` in `features/payment/payment-logic.ts`). Refusals are non-informative (`not-found` / `notFound()`).
- **Authoritative-amount guard ignored currency (payment safety).** `completePaidIntent` compared minor units only, so a verified notification in another currency with the same minor amount passed. Fixed with a case-insensitive `currencyMatches` check (intents store `ZAR`, providers report `zar`); a mismatch is rejected as `amount-mismatch` before any order/payment is created.
- **Archived products were still orderable (data integrity).** `getCheckoutSummaryAction` silently skipped archived cart lines while `startCheckoutPaymentAction` still passed them through, and neither product load in `lib/db/payments.ts` filtered `archived: false` — so an item archived after being added to the cart was charged for at a total higher than the summary displayed. Fixed: both authoritative product loads exclude archived products, checkout returns an actionable error, and the cart marks such lines unavailable and excludes them from totals and the header count.
- **Admin helpers documented as store-scoped but not scoped (defence in depth).** `updateProduct`/`deleteProduct`/`restoreProduct`, `updateCategory`/`deleteCategory`, and `listInventory` resolved the default store id and then ignored it; product create/update accepted any `categoryId`. Fixed by verifying row (and referenced category) ownership before mutating, matching the pattern already used by `updateInventory`. Single-store MVP, so this was not a live exposure.
- **Storefront category counts included archived products (correctness).** `/categories` and the home page advertised counts that included soft-deleted items. Fixed; the admin categories page explicitly requests total counts so admin numbers stay accurate.
- **UX (MVP-level).** The storefront nav was hidden below `md` with no mobile alternative, making Products/Categories/About/Pricing/Contact unreachable on a phone — a compact mobile menu was added. The admin topbar's non-functional "Search..." box was removed (admin search is not in MVP scope).
- **Tests:** 7 new pure-logic tests — the mock-payment gate (production, non-test provider, foreign shopper, intended local case), the currency guard (case-insensitive match, mismatch), and archived cart lines excluded from subtotal/item count. Total test suite: **119 tests**.

### Verified as already correct (no change needed)

- Orders are created only inside `completePaidIntent`, only after a signature-verified provider notification, atomically with price snapshots, quantity-guarded inventory decrement, and a `SUCCEEDED` `Payment`; duplicate deliveries are idempotent (`completedPayloadKey` unique + guarded `PENDING` transition), failed notifications mark the intent `FAILED` and create no order, and the cart is cleared only after the transaction commits.
- Payment status (`Payment.status`) stays distinct from fulfillment status (`Order.status`); the admin UI can only set fulfillment statuses (`PENDING`/`REFUNDED` excluded).
- Customer order access is scoped server-side to the authenticated customer's id, so a foreign order number is indistinguishable from a missing one; every admin page uses `requireAdminOrRedirect()` and every admin server action `requireAdmin()` before any data access; the admin role lives in Clerk `privateMetadata` (server-only, not forgeable).
- All user input crossing a trust boundary is validated server-side with Zod; no secrets are hard-coded; `.env*` remains gitignored.
- Schema relationships, `onDelete` behavior, unique constraints, and nullability match the MVP requirements. No schema change was needed in this audit.

### Remaining MVP limitations (honest status)

- **Cart store:** in-memory (`MemoryCartStore`). Correct for a single dev/demo instance; carts are lost on restart and are not shared across instances. `REDIS_URL` is read but no Redis store is wired up. Not required for the MVP deliverable.
- **Stripe/PayFast:** implemented and unit-tested against real signature math, but never exercised against the live Stripe API or PayFast sandbox with real credentials. The mock Test gateway is what the end-to-end flow has actually been run through.
- **Clerk-authorized admin flows:** the admin authorization code paths are unit-tested and the routes were verified to redirect unauthenticated requests, but the authorized-admin journey (create/edit/archive/restore product, category and inventory edits, order status updates) requires a live Clerk session with `privateMetadata.role = "admin"` and has **not** been manually exercised with real Clerk credentials.
- **Order numbers:** `SN-YYYYMMDD-XXXXXX` uses a random 6-digit suffix with a unique constraint, so a same-day collision surfaces as a checkout error rather than being retried. Acceptable at MVP volume.
- **`/checkout/success?orderNumber=…`** is intentionally reachable without signing in (guest checkout) and shows status and totals only — no name, address, email, or line items.

### Post-MVP roadmap (explicitly deferred, not MVP requirements)

AI/LLM features and agents, pgvector semantic/vector search, PostgreSQL full-text and trigram search, product federation and marketplace integrations (Shopify/Amazon/Takealot/AliExpress), advanced analytics, marketing automation, live courier integrations (Bob Go, Aramex, PUDO, Courier Guy — the `ShippingProvider` seam is in place), additional payment gateways (Yoco, Stitch — the provider abstraction supports them), a Redis cart store, and admin search. `GUIDEBOOK.md` describes this longer-term platform vision; none of it is required to finish the MVP.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run db:seed` | Seed demo data |
| `npm run set-admin -- <clerkUserId> [--remove]` | Grant/revoke the admin role on a Clerk user |
| `npx prisma db push` | Sync schema to DB |
| `npx prisma studio` | Open DB browser |
| `npx prisma validate` | Validate Prisma schema |
| `npx prisma generate` | Generate Prisma Client |