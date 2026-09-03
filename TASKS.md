# ShopNova — Task Tracker

> **MVP status: complete.** All `[x]` items in this file are implemented and verified. The final two sections (`MVP — Known Limitations` and `Post-MVP Roadmap`) are non-blocking limitations and deferred work, respectively.

## Foundation

- [x] Initialize Next.js project
- [x] Install dependencies (Prisma, shadcn/ui, Zod, RHF, TanStack Query, Clerk, Supabase)
- [x] Create folder structure
- [x] Create markdown docs (README, AGENTS, PROJECT, TASKS)
- [x] Create clean home page

## Database & Auth

- [x] Prisma schema + PostgreSQL connection
- [x] Clerk authentication
- [x] Prisma seed system (idempotent)
- [x] Seed demo data (16 products, 5 categories, inventory records)

## Product Browsing

- [x] Home page
- [x] Products listing page
- [x] Categories listing page
- [x] Product detail page

## Cart (Sprint 3, Part 1)

- [x] Cart business logic (pure functions, unit tested)
- [x] Cart store abstraction (Redis-ready, in-memory dev store)
- [x] Shopper/session identity (Clerk user or anonymous cookie)
- [x] Server actions for cart mutations
- [x] Add to Cart button on product detail page (with quantity selector)
- [x] Cart link/icon in storefront header with item count
- [x] /cart page (lines, quantity controls, remove, clear, subtotal)
- [x] Unit tests for cart calculations (14 tests)

## Checkout & Order (Sprint 3, Part 2)

- [x] Checkout form (contact info + shipping address, RHF + Zod)
- [x] /checkout route (requires a non-empty cart)
- [x] Authoritative order summary (server re-reads prices/inventory)
- [x] South African VAT calculation (15%) as a pure, tested function
- [x] Deterministic MVP shipping calculation (free ≥ $50, flat $5 below)
- [x] Order creation in an atomic transaction (inventory-safe)
- [x] Customer find-or-create preserving `@@unique([storeId, email])`
- [x] OrderItem price snapshots from authoritative DB values
- [x] Order number generation (SN-YYYYMMDD-XXXXXX, not DB id)
- [x] Cart clears only after successful order creation
- [x] Insufficient inventory prevents order creation (no partial order)
- [x] Order confirmation page (/checkout/success) — shows CONFIRMED (paid) vs not-yet-confirmed payment state
- [x] Unit tests for VAT, shipping, subtotal, total, quantity, order number (17 tests)

## Payment Architecture & Integration (Sprint 3, Part 3)

- [x] Prisma schema: `CheckoutIntent`, `Payment`, `PaymentStatus`, `CheckoutIntentStatus` enums
- [x] `Order.currency` field added (additive, default `ZAR`)
- [x] Payment-provider abstraction (`features/payment/types.ts`) — `PaymentProvider` interface
- [x] Provider registry (`features/payment/provider-registry.ts`) — only configured gateways are selectable
- [x] Stripe adapter (`features/payment/stripe.ts`) — hosted Checkout Sessions, HMAC-SHA256 webhook verification
- [x] PayFast adapter (`features/payment/payfast.ts`) — hosted form, MD5 ITN signature verification
- [x] Yoco adapter (`features/payment/yoco.ts`) — hosted Checkout API (`payments.yoco.com/api/checkouts`), Standard Webhooks webhook verification (`webhook-*` headers, shared `standard-webhooks.ts` verifier). Implemented per the official public API contract; unit-tested against real signature math with mocked `fetch`; NOT exercised against the live Yoco API.
- [x] Stitch adapter (`features/payment/stitch.ts`) — Svix/Standard Webhooks webhook verification (`svix-*` headers) + OAuth 2.0 client-credentials token helper + hosted-payment-session creation via the official `clientPaymentInitiationRequestCreate` GraphQL mutation (`POST https://api.stitch.money/graphql`, Bearer client token with `client_paymentrequest` scope, `Idempotency-Key` header, `amount.quantity` in MAJOR units/Rand, `externalReference` = intent id, `payerReference`/`beneficiaryReference` clamped to documented limits, `payerInformation.payerId`, `expireAt`; response `paymentInitiationRequest { id url }`, `redirect_uri`/`failure_redirect_uri` appended to the hosted url). Implemented per the official public API contract and unit-tested against real signature math (mocked `fetch`); NOT exercised against the live Stitch sandbox (no credentials in this environment). Registered and selectable behind the abstraction when `STITCH_CLIENT_ID` + `STITCH_CLIENT_SECRET` + `STITCH_WEBHOOK_SECRET` are all set; checkout routing still defaults to PayFast (SA) / Stripe (international).
- [x] Standard Webhooks verifier (`features/payment/standard-webhooks.ts`) — dependency-free (Node `crypto` only) implementation shared by Yoco + Stitch/Svix: `whsec_` secret prefix + base64 decode, HMAC-SHA256 over `id.timestamp.body`, constant-time compare, `v1,<sig>` list parsing with key-rotation support, replay protection (180s default, 3600s max), 1 MiB body guard.
- [x] Test/mock adapter (`features/payment/test.ts`) — signed mock gateway for local dev + tests
- [x] Test provider gated to non-production (never registered in `NODE_ENV=production`)
- [x] Payment business logic (`features/payment/payment-logic.ts`) — provider selection, authoritative-amount guards
- [x] Shipping-provider seam (`features/shipping/shipping-provider.ts`) — `ShippingProvider` interface, MVP provider keeps deterministic rule
- [x] `lib/db/payments.ts` — `createCheckoutIntent` + `completePaidIntent` (atomic, idempotent, inventory-safe)
- [x] Order is created ONLY after a server-verified payment notification (CONFIRMED, not PENDING)
- [x] Authoritative amount guard: gateway charge must exactly match server-computed intent amount
- [x] Idempotency: `completedPayloadKey` unique + `status: PENDING` guarded transition prevents duplicate orders / double inventory decrement
- [x] Raw card data never touches ShopNova servers (hosted Stripe Checkout / PayFast form / mock page)
- [x] `startCheckoutPaymentAction` server action — validates form, creates intent, selects provider server-side, returns redirect URL
- [x] `completeTestPaymentAction` server action — mock verified callback for the Test gateway
- [x] Webhook API routes: `/api/webhooks/stripe`, `/api/webhooks/payfast`, `/api/webhooks/yoco`, `/api/webhooks/stitch`, `/api/webhooks/test`
- [x] Shared webhook handler (`features/payment/webhook-handler.ts`) with correct HTTP status codes
- [x] Provider-match security check (`isProviderMatch` in `payment-logic.ts`) — a verified notification from gateway X cannot complete a `CheckoutIntent` created for gateway Y; enforced in `completePaidIntent` (returns `provider-mismatch`, HTTP 400) in addition to provider-scoped routes + per-adapter signature verification
- [x] Mock hosted payment page (`/checkout/test-pay`) for local end-to-end verification
- [x] Checkout view wired to the payment-gated flow (redirect to hosted payment UI)
- [x] `/checkout/success` updated to reflect paid (CONFIRMED) vs pending status
- [x] Removed dead code: `placeOrderAction` and `createOrder` (replaced by intent-based flow)
- [x] Unit tests for payment logic (11 tests) — authoritative amount, provider selection, provider resolution
- [x] Unit tests for webhook verification (15 tests) — valid/invalid/missing signatures, failed payments, ignored events, PayFast MD5 stability
- [x] Unit tests for the Standard Webhooks verifier (16 tests) — valid Yoco `webhook-*` + Stitch `svix-*` signatures, byte-exact body, wrong secret, missing headers, non-v1 entries, key rotation, replay/timestamp tolerance, 3600s max, non-numeric timestamp, `whsec_` prefix, empty secret, 1 MiB body guard, header-prefix isolation
- [x] Unit tests for Yoco + Stitch provider behavior (22 tests) — `createSession` request/response contract (mocked `fetch`), non-OK/no-redirect failures, `payment.succeeded`/`payment.failed`/unhandled events, invalid/missing/replayed signatures, malformed body, wrong-provider intent passthrough; Stitch `isConfigured === false`, `createSession` pending error, Completed/Cancelled/Expired/Pending states, Svix idempotency key, amount parsing, missing node
- [x] Test runner loader shim for `server-only` + extensionless relative `.ts` import retry (`scripts/test-register.mjs` + `test-loader.mjs`)

## Product Search

- [x] Pure search logic module (`features/search/search-logic.ts`) — query normalization/validation, case-insensitive substring matcher, pure reference `searchProducts` implementation, limit clamping
- [x] `searchStorefrontProducts` DB query (`lib/db/products.ts`) — PostgreSQL `ILIKE` substring matching across product name, description, sku, and category name; `archived: false` always applied; results ordered by name asc; clamped to 24 results
- [x] URL-addressable search results at `/products?search=<query>` (bookmarkable/shareable; search state lives in the URL, not ephemeral client state)
- [x] `/products` page handles: valid search → results, empty/missing search → browse all, no matches → empty state, invalid/over-long query → browse all
- [x] `SearchBox` client component in storefront header (`components/storefront/search-box.tsx`) — GET form submitting to `/products?search=...`, accessible label (`sr-only` + `aria-label`), `role="search"`, seeds input from URL, works on desktop and mobile
- [x] Header layout updated to include the search box (wrapped in `Suspense` for `useSearchParams`); nav links hidden on mobile to make room for search
- [x] Archived products never returned by search (DB filter + pure matcher)
- [x] Server-side filtering only — full catalog never shipped to the browser; parameterized Prisma queries (no raw SQL, no SQL injection)
- [x] Unit tests for search logic (28 tests) — name/description/sku/category matching, case-insensitive, partial/substring, no results, archived excluded, empty/invalid query, ordering, limit clamping, null fields
- [x] Verification: `npx prisma validate`, `npm test` (111 tests), `npx tsc --noEmit`, `npx eslint .` (0 errors), `npx next build`, manual dev-server route check (home/products/search variants/category/product detail/cart all 200; admin routes 307 redirect)

## Customer Accounts & Order History

- [x] Additive schema change: `Customer.clerkUserId` (nullable, unique) links Clerk users to Customer rows
- [x] `completePaidIntent` sets `clerkUserId` on the Customer when a signed-in shopper completes checkout
- [x] `lib/db/customers.ts` — `getCustomerForClerkUser` resolves the authenticated Clerk user to their Customer row
- [x] `lib/db/orders.ts` — `getOrdersForCustomer` (customer-scoped order history) + `getOrderForCustomer` (customer-scoped single order)
- [x] `features/account/account-logic.ts` — pure authorization helpers (`clerkUserIdFromShopperId`, `isOrderOwnedByCustomer`, `assertOrderOwnedByCustomer`, `buildDisplayName`)
- [x] Account overview page (`/account`) — Clerk name/email, order count, navigation to order history
- [x] Order history page (`/account/orders`) — order number, date, status, total, item count; empty-state handling
- [x] Order detail page (`/account/orders/[orderNumber]`) — items, line totals, subtotal/VAT/shipping/total, shipping/contact info, payment summary
- [x] Server-side authorization: every order query is scoped to the authenticated customer's id; foreign orders return null → `notFound()`
- [x] In-page auth checks (`redirect("/sign-in?redirect_url=...")`) — Clerk v7 deprecates middleware-based `auth.protect()`
- [x] Storefront header: `AccountButton` (Sign in / Account link + Clerk `UserButton`)
- [x] Unit tests for account logic (15 tests) — Clerk/customer association, order ownership, display name fallbacks
- [x] Verification: `npx prisma validate`, `npx prisma db push`, `npm test` (71 tests), `npx tsc --noEmit`, `npx eslint .`, `npx next build`, manual dev-server route check

## Admin Dashboard & Store Management

- [x] Admin authorization via Clerk `privateMetadata.role === "admin"` (server-only, not forgeable in browser)
- [x] `features/admin/admin-logic.ts` — pure auth helpers (`isAdminRole`, `assertAdminRole`, `roleFromMetadata`, order-status rules) + `AdminRequiredError`/`UnauthenticatedError`
- [x] `lib/auth/admin.ts` — `requireAdmin()` (server actions), `requireAdminOrRedirect()` (pages), `getAdminContext()` (non-throwing, header link)
- [x] Additive schema change: `Product.archived` (nullable-safe boolean, default false) for soft-delete
- [x] Middleware: lightweight auth gate redirecting unauthenticated `/dashboard(.*)` to sign-in (role check stays in-page because privateMetadata is not in the JWT)
- [x] Dashboard KPI overview (`/dashboard`) — total/active/archived products, categories, customers, orders, pending orders, low-stock count, recent orders
- [x] Product management (`/dashboard/products`) — list, create, edit, archive (soft-delete), restore; SKU, price, compare-at price, description, category; archived badge + stock column
- [x] Safe product deletion: archive (not hard delete) so `OrderItem` (onDelete: Restrict) historical references stay intact
- [x] Category management (`/dashboard/categories`) — list, create, edit, delete with product-count pre-check (blocks deletion when products still reference the category)
- [x] Inventory management (`/dashboard/inventory`) — list stock + thresholds, low-stock badges, update quantity and/or low-stock threshold via server action
- [x] Order management (`/dashboard/orders` + `/dashboard/orders/[orderNumber]`) — list, detail (items, totals, customer, shipping, payment summary), fulfillment status update
- [x] Payment security: admin can only set fulfillment statuses (CONFIRMED/PROCESSING/SHIPPED/DELIVERED/CANCELLED); PENDING and REFUNDED excluded so an admin UI action can never mark an order paid/refunded — payment state stays webhook-driven
- [x] Customer management (`/dashboard/customers` + `/dashboard/customers/[customerId]`) — list with order count, detail with order history; no auth identifiers (clerkUserId) exposed
- [x] Storefront admin link (`AdminLink` server component) — visible only to admins; UI convenience only, not the security boundary
- [x] `scripts/set-admin.ts` — grant/revoke admin role via Clerk Backend API (`npm run set-admin -- <clerkUserId> [--remove]`)
- [x] Storefront product/cart queries filter `archived: false` so soft-deleted products disappear from the storefront
- [x] Server-side authorization on every admin page and every admin server action (product/category/inventory/order)
- [x] Unit tests for admin logic (12 tests) — role matching, metadata extraction, assertAdminRole, order-status rules (PENDING/REFUNDED rejected)
- [x] Verification: `npx prisma validate`, `npx prisma db push`, `npm test` (83 tests), `npx tsc --noEmit`, `npx eslint .`, `npx next build`, manual dev-server route check (unauthenticated `/dashboard*` → 307 redirect to sign-in; storefront 200)

## Final MVP Audit (Sprint 7)

Audit of the implemented MVP against `GUIDEBOOK.md` — customer journey, admin journey, security boundaries, data integrity, payment safety, responsive UX, tests.

- [x] Mock Test-gateway completion locked down: `completeTestPaymentAction` and `/checkout/test-pay` now require non-production + `provider === "test"` + intent ownership (pure `isTestPaymentAllowed`). Previously a client could complete a real Stripe/PayFast intent for free, or complete/decline another shopper's intent.
- [x] Authoritative-amount guard also compares currency (case-insensitive `currencyMatches`); a mismatch is rejected before any order/payment is created
- [x] Archived products can no longer be ordered: both authoritative product loads in `lib/db/payments.ts` filter `archived: false`; checkout returns an actionable error instead of silently charging for an item the summary omitted
- [x] Cart marks archived lines unavailable and excludes them from the subtotal and header item count
- [x] Admin mutations verify default-store ownership before writing (products, categories, referenced category on product create/update); `listInventory` scoped to store products
- [x] Storefront category product counts exclude archived products (admin counts stay total)
- [x] Mobile storefront navigation added (nav links were unreachable below `md`) — closes after navigation, panel pinned inside the viewport, header search collapses to an icon below `sm` so there is no horizontal overflow at 390px
- [x] Test-payment gate resolves identity read-only (`getExistingShopperId`) so a first-ever visitor with no cart cookie is denied with a 404 instead of crashing (a Server Component cannot set cookies)
- [x] Removed the non-functional "Search..." box from the admin topbar
- [x] Unit tests for the new pure guards (8 tests): mock-payment gate (production / non-test provider / foreign shopper / missing identity / intended local case), currency guard (match + mismatch), archived cart lines excluded from totals
- [x] Runtime browser verification of the storefront journey against seeded PostgreSQL: browse/search, cart, checkout arithmetic, mock-gateway pay and decline paths (order/order items/price snapshots/`SUCCEEDED` payment/inventory decrement confirmed in the database; decline creates no order), archived-product guard, ownership gate, 390px layout
- [x] Verification: `npx prisma validate`, `npx tsc --noEmit`, `npm test` (119 tests), `npx eslint .` (0 errors, 3 pre-existing warnings), `npx next build`, dev-server route checks

Audited and found already correct (no change made): verified-webhook-only order creation, webhook idempotency, failed-payment handling, payment-vs-fulfillment status separation, customer order-ownership scoping, admin authorization on every page and server action, Clerk `privateMetadata` role model, server-side Zod validation, no hard-coded secrets, `.env*` gitignored, schema relationships/constraints/`onDelete` behavior. No schema change was required.

## MVP — Known Limitations (non-blocking)

No MVP requirement is known to be unimplemented. These are genuine limitations of the current build (documented, not blockers):

- ~~In-memory cart store (`MemoryCartStore`); carts do not survive a restart and are not shared across instances~~ **Resolved by Post-MVP #1 (Redis cart persistence).** `MemoryCartStore` remains as the development-only fallback when Redis credentials are absent.
- Cart read-modify-write is not atomic across the load → mutate → save cycle; two simultaneous mutations for the same shopper could race (last write wins). The Redis `SET ... EX` write itself is atomic, and distributed locking is intentionally not added (acceptable for a single-shopper cart).
- Stripe and PayFast are unit-tested against real signature math but have never been exercised against the live Stripe API / PayFast sandbox with real credentials
- The authorized-admin journey (product/category/inventory/order mutations) has not been manually exercised with a live Clerk admin session — code paths are unit-tested and route protection was verified
- Order numbers use a random 6-digit suffix with a unique constraint; a same-day collision surfaces as a checkout error rather than being retried

## Post-MVP Roadmap (deferred — not started)

- [x] **Redis cart store (Post-MVP #1)** — `RedisCartStore` backed by Upstash Redis (REST API) with a 30-day TTL, behind the existing provider-agnostic `CartStore` abstraction. Configure `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`; production fails fast with `CartConfigurationError` when these are absent (no silent in-memory fallback). Development falls back to `MemoryCartStore` when Redis is not configured.
- [~] **Live courier API integration (Post-MVP #2)** — `ShippingProvider` abstraction + registry complete; checkout obtains an authoritative server-side shipping quote from the destination. **Bob Go** (the guidebook's multi-courier API) is implemented, registered, and **live-sandbox-verified** (Post-MVP #4 + live verification); Aramex / PUDO / The Courier Guy adapters remain pending official API contracts/credentials. The deterministic MVP provider remains the documented fallback when no live courier is configured.
- [~] Additional payment gateways: Yoco (implemented + tested, pending live-API verification), Stitch (implemented + tested per the official `clientPaymentInitiationRequestCreate` GraphQL contract, pending live-API verification)
- [ ] AI/LLM features and agents
- [ ] pgvector semantic/vector search; PostgreSQL full-text (`tsvector`) and trigram (`pg_trgm`) search
- [ ] Product federation / marketplace integrations (Shopify, Amazon, Takealot, AliExpress)
- [ ] Advanced analytics and marketing automation
- [ ] Admin search

## Post-MVP #1 — Redis Cart Persistence

- [x] Inspect existing cart implementation (`cart-store`, `actions`, `session`, `cart-logic`, `cart-context`, db helpers, `.env.example`, `package.json`, Prisma, guidebook cart architecture)
- [x] `RedisCartStore` (`features/cart/redis-cart-store.ts`) using `@upstash/redis` REST client (Next.js/Vercel serverless compatible); minimum dependency added
- [x] Provider-agnostic abstraction preserved (`CartStore` interface; `MemoryCartStore` kept for dev; `RedisCartStore` for real persistence)
- [x] Environment configuration via `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (added to `.env.example`); no real credentials committed; `.env.local` not committed
- [x] Store selection: Redis when configured → `RedisCartStore`; dev without credentials → `MemoryCartStore`; production without credentials → `CartConfigurationError` (no silent fallback). Lazy resolution so `next build` is credential-free
- [x] Redis key design: `cart:<shopper-id>` (namespaced, stable, per-shopper; reuses existing shopper/session identity; no PII)
- [x] Serialization: only the cart data needed is stored (no full Prisma Product records); money stored as the existing number snapshot; `serializeCart`/`deserializeCart` round-trip safely and reject corrupt payloads
- [x] TTL: `CART_TTL_SECONDS = 60 * 60 * 24 * 30` (30 days), refreshed on every write via atomic `SET ... EX`
- [x] Concurrency: atomic `SET ... EX` write; read-modify-write race documented as a known limitation (no distributed locking added)
- [x] Local development: `MemoryCartStore` preserved; active store choice explicit; production Redis requirement documented
- [x] Existing functionality unchanged: add to cart, add same product, quantity update, remove item, clear cart, item count, subtotal, inventory limits, checkout, payment initiation, cart clearing after payment, anonymous/authenticated carts, customer/account, admin — no unrelated code modified
- [x] Tests: 23 Redis cart store + selection tests (write/read round trip, update, remove, clear, empty/missing, TTL config, serialization/deserialization, shopper isolation, config detection, production config failure, error handling with credential-free messages). Existing pure cart-logic tests kept. Total suite: 142 tests
- [x] Error handling: Redis failures throw `CartStoreError` (generic, credential-free message; original error on `cause`); never silently succeeds
- [x] Documentation: PROJECT.md, TASKS.md, README.md, `.env.example` updated; GUIDEBOOK.md untouched
- [x] Verification: `npx prisma validate`, `npx tsc --noEmit`, `npm test` (142 tests), `npx eslint .` (0 errors, 3 pre-existing warnings), `npx next build` — all pass
- [x] Real Redis was NOT exercised (no Upstash credentials in this environment); implementation verified with a fake `RedisLike` client; `MemoryCartStore` fallback and selection logic verified

## Post-MVP #2 — Live Courier / Shipping API Integration

- [x] Inspected GUIDEBOOK.md, PROJECT.md, TASKS.md, existing checkout logic, checkout actions, checkout validation, order creation (`lib/db/payments.ts`), Order schema, the existing `ShippingProvider` seam, `.env.example`, `package.json`, existing tests
- [x] `ShippingProvider` abstraction (`features/shipping/shipping-provider.ts`) — `ShippingProvider` interface, `ShippingQuoteRequest`/`ShippingQuote` types, `ShippingAddress`/`Parcel`, `ShippingProviderError`, `ShippingProviderId` union (mvp/bobgo/aramex/pudo/courier-guy)
- [x] `MvpShippingProvider` keeps the deterministic free-above-$50 / flat-$5 rule (the documented deliberate fallback); `FakeShippingProvider` for deterministic tests
- [x] Pure shipping logic (`features/shipping/shipping-logic.ts`) — destination completeness (type guard), address normalization, parcel/request building, `normalizeQuote` (defensive validation of provider responses), `selectCheapestQuote` (cents math, deterministic tie-break), quote↔snapshot round-trip
- [x] Server-only provider registry (`features/shipping/provider-registry.ts`) — `selectProvidersFromFactories`, `getConfiguredShippingProviders`, `collectQuotesFromProviders` (`Promise.allSettled` fan-out per guidebook), `getShippingQuotes`, `getAuthoritativeShippingQuote`, `getShippingOrigin` (env-configurable), `ShippingQuoteError`
- [x] Provider strategy: when one or more live couriers are configured, ONLY live couriers are queried (MVP is NOT a silent fallback — a failed live quote is never replaced with an arbitrary price); when no live courier is configured, the deterministic MVP provider is used (documented fallback)
- [x] Failure behavior: if every configured provider fails or returns no valid quote, `ShippingQuoteError` is thrown — checkout surfaces a safe user-facing error and creates no order with an incorrect amount; provider errors are preserved on `causes` for server-side diagnostics (never exposed to the client)
- [x] Additive Prisma schema (no data reset, no existing order modified): `CheckoutIntent.shipping` (snapshotted amount) + `CheckoutIntent.shippingQuote` (full quote JSON); `Order.shippingProvider` + `Order.shippingMethod` (nullable for historical orders)
- [x] Authoritative quote wired into `createCheckoutIntent` — server obtains the quote from the validated destination via the abstraction, snapshots it on the intent, computes the authoritative total. The client never supplies a shipping rate (only the address)
- [x] `completePaidIntent` reuses the snapshotted shipping (never re-fetches a live quote at order creation) so the order reproduces exactly what was charged; legacy intents (no snapshot) fall back to the deterministic rule
- [x] Order snapshot: `Order.shipping` amount + `shippingProvider` + `shippingMethod` captured at order time; historical orders are never retroactively changed when rates change
- [x] Destination-aware checkout summary (`getCheckoutSummaryAction`) — uses the provider abstraction when a complete destination is supplied; deterministic MVP estimate before the address is filled. `CheckoutSummary` now includes `shippingProvider`/`shippingMethod`
- [x] `getShippingQuoteAction` (`features/shipping/actions.ts`) — server-side entry point to obtain quotes for a destination; subtotal recomputed server-side; client supplies only the address
- [x] Checkout view re-fetches the summary with the destination once the address is complete (RHF `useWatch`); the client is never authoritative for the shipping rate
- [x] Order detail pages (account + admin) show the shipping method when present (additive; historical orders show amount only)
- [x] Address validation reuses the existing checkout address fields; no checkout form redesign. Provider-specific address mapping happens inside adapters via the common internal `ShippingAddress`
- [x] Environment variables: `SHIPPING_ORIGIN_*` (optional, SA defaults) added to `.env.example`; live courier credential variables documented as pending placeholders; courier secrets are server-only and never reach the client
- [x] Tests: 55 shipping tests (`features/shipping/shipping-logic.test.ts` + `features/shipping/shipping-provider.test.ts`) — provider contract, quote normalization, provider selection, successful quote, provider failure, invalid/malformed responses, missing configuration, currency mismatch, shipping-cost calculation, checkout total integration, protection against client-supplied shipping manipulation (form schema has no shipping field; total uses server quote rate). Total suite: 197 tests. No real courier credentials required (`FakeShippingProvider` + extracted pure registry helpers)
- [x] Existing tests kept passing; Redis cart, payment, account, admin, search functionality unchanged
- [x] Documentation: PROJECT.md, TASKS.md, README.md, `.env.example` updated; GUIDEBOOK.md untouched
- [x] Verification: `npx prisma validate`, `npx prisma generate`, `npx tsc --noEmit`, `npm test` (197 tests), `npx eslint .` (0 errors, 2 pre-existing warnings), `npx next build` — all pass
- [x] No live courier API was exercised (no official credentials/contracts in this environment); the deterministic MVP provider + `FakeShippingProvider` verify the abstraction, registry, snapshot, and checkout integration. Live courier adapters (Bob Go, Aramex, PUDO, The Courier Guy) remain pending official API contracts + server-side credentials

## Post-MVP #3 — Stitch Payment-Gateway Completion

- [x] Inspected existing Stitch implementation, payment abstraction, checkout-intent flow, webhook routes, tests, documentation, and GUIDEBOOK requirements
- [x] Researched the official Stitch documentation (docs.stitch.money) and confirmed the `clientPaymentInitiationRequestCreate` GraphQL mutation contract is now publicly available in full: mutation signature, `ClientPaymentInitiationRequestCreateInput` field list, `MoneyInput` (`quantity` Decimal + `currency`), `PayerInformationInput.payerId`, `ClientPaymentInitiationRequestCreatePayload.paymentInitiationRequest { id url }`, the GraphQL endpoint (`https://api.stitch.money/graphql`), Bearer client-token auth (`client_paymentrequest` scope), the `Idempotency-Key` header, the hosted-url `redirect_uri`/`failure_redirect_uri` query params, and the documented character limits (`payerReference` ≤12, `beneficiaryReference` ≤20, `externalReference` ≤4096)
- [x] Critical correctness fix: the official docs confirm `MoneyInput.amount.quantity` is in MAJOR units (Rand), NOT cents (Money scalar example `{"quantity":"100.23"}`; OTA API "amount in major units (e.g. 350.5 for R350.50)"). The previous webhook handler treated `quantity` as cents — a latent bug that would have made every real Stitch webhook fail the authoritative-amount guard (fail-closed/safe, but Stitch could never complete a payment). Replaced `parseStitchAmount` with `majorUnitsToCents` (`Math.round(Number(quantity) * 100)`) and added `centsToStitchMajorUnits` (pure integer math, 2-dp string) so the create→webhook round-trip is consistent with the server-computed intent amount
- [x] Implemented `StitchProvider.createSession` through the existing `PaymentProvider` abstraction: obtains a client token via the existing `getStitchClientToken` helper, POSTs the GraphQL mutation with Bearer auth + `Idempotency-Key` (intent id), sets `externalReference` = intent id (webhook correlation), `payerReference`/`beneficiaryReference` derived from the order number (sanitized + clamped to documented limits), `payerInformation.payerId` = customer email (recommended for fraud checks), `expireAt` = now + 30 min ISO, parses `paymentInitiationRequest { id url }`, appends `redirect_uri` (success) + `failure_redirect_uri` (cancel) to the hosted url, returns `{ provider, redirectUrl, providerReference: id }`. Handles non-OK HTTP, GraphQL `errors[]` (with extension code), missing id, and missing url
- [x] `StitchProvider.isConfigured()` now returns true only when the creation flow is implemented AND all three server-side credentials are present (`STITCH_CLIENT_ID` + `STITCH_CLIENT_SECRET` + `STITCH_WEBHOOK_SECRET`); the provider can never be selected by checkout until the complete flow + credentials are in place
- [x] All credentials stay server-side (`import "server-only"`); the client secret and webhook secret never reach the browser; the browser redirect `status` is never trusted for payment state (signed Svix webhook only)
- [x] Verified security guarantees remain intact: provider matching (`isProviderMatch`), Svix webhook signature verification (shared `standard-webhooks.ts` verifier), intent ownership, authoritative amount + currency validation (`amountMatches`/`currencyMatches` in `completePaidIntent`), replay protection (Svix timestamp tolerance), idempotency (`completedPayloadKey` + guarded PENDING→COMPLETED transition), and payment-state transitions (webhook-driven; admin can only set fulfillment statuses). Existing security tests were not weakened
- [x] Exported pure helpers (`centsToStitchMajorUnits`, `majorUnitsToCents`, `stitchReference`, `buildStitchRedirectUrl`) for direct unit testing
- [x] Tests: 14 new/updated Stitch tests in `features/payment/yoco-stitch.test.ts` — `createSession` GraphQL request contract (endpoint, Bearer auth, `Idempotency-Key`, query/variables shape, `amount.quantity` in major units, `externalReference` = intent id, references within char limits, `payerId`, `expireAt`), hosted-url `redirect_uri`/`failure_redirect_uri` appending, non-OK HTTP failure, GraphQL `errors[]` (IDEMPOTENCY_KEY_ALREADY_USED), missing id, missing url, refuses-when-not-configured, `isConfigured` true/false per credential presence, `centsToStitchMajorUnits`/`majorUnitsToCents` round-trip, `stitchReference` sanitization+truncation, `buildStitchRedirectUrl` param encoding. Existing Stitch webhook tests updated to the real major-unit contract (`quantity: "115.00"` → 11500 cents; `"19.99"` → 1999). Total suite: 255 tests
- [x] Existing functionality unchanged: Yoco, Stripe, PayFast, Test gateway, Redis cart, checkout, account, admin, search, shipping — no unrelated code modified
- [x] Documentation: PROJECT.md, TASKS.md, README.md updated; GUIDEBOOK.md untouched
- [x] Verification: `npx prisma validate`, `npx prisma generate`, `npm test` (255 tests), `npx tsc --noEmit`, `npx eslint .` (0 errors, 4 pre-existing `_query`-unused warnings shared by all provider adapters), `npx next build` — all pass. Runtime check: dev-server POST to `/api/webhooks/stitch` returns `400 {"ok":false,"result":"provider_not_configured"}` when credentials are absent (route + registry gating confirmed)
- [x] No live Stitch sandbox call was made (no `STITCH_*` credentials in `.env.local`); `createSession` is verified with mocked `fetch` and the webhook path with real Svix signature math. Live-API verification remains pending real credentials

## Post-MVP #4 — Bob Go Live Courier Adapter

- [x] Investigated the official developer/API documentation for the four roadmap couriers (Bob Go, Aramex, PUDO, The Courier Guy) before writing any adapter. Selected **Bob Go** as the first live courier integration:
  - **Bob Go** — publicly documented REST API (api-docs.bob.co.za) with a dedicated sandbox (`https://api.sandbox.bobgo.co.za/v2`) and production (`https://api.bobgo.co.za/v2`) base URL, Bearer-token auth, a `POST /rates` rate endpoint, and a documented request/response schema (collection_address, delivery_address, parcels with cm dimensions + kg weight, declared_value; response: rates array / provider_rate_requests[].responses[]). It is the guidebook's "multi-courier API" (aggregates ~12 SA courier partners behind one integration). No geocoding required — accepts standard address fields that map cleanly from the existing `ShippingAddress`.
  - **The Courier Guy** — public REST API (api-tcg.co.za, `POST /rates`) with a sandbox (sandbox.shiplogic.com), but the rate endpoint requires geocoded addresses (lat/lng) which the current checkout form does not collect; would require a geocoding dependency. Deferred.
  - **Aramex** — SOAP/WSDL-based Rate Calculator; the WSDL must be requested from the Aramex EDI team (not publicly downloadable in full), and the integration is XML/SOAP rather than REST. Less suitable for a modern Node/REST adapter. Deferred.
  - **PUDO** — locker-delivery API whose access requires emailing integrations@pudo.co.za for the API URL/key (not openly documented). Deferred.
- [x] `BobGoProvider` adapter (`features/shipping/couriers/bobgo.ts`) implemented behind the existing `ShippingProvider` interface — no checkout or UI changes; the application still depends only on the abstraction. `id = "bobgo"`, `isConfigured()` true only when `BOBGO_API_KEY` is present, `quote()` POSTs to `POST /rates` with `Authorization: Bearer <key>` + JSON body, parses every documented response shape (bare array, `{rates|data|results}`, `{provider_rate_requests[].responses[]}` with success filtering), and maps each rate to a `ShippingQuote` (`provider: "bobgo"`, `estimateDays: null` — the rates endpoint does not reliably expose delivery days, so none are invented).
- [x] All credentials stay server-side (`import "server-only"`); the API key never reaches the browser. Raw provider responses are NEVER trusted — every rate is validated by the existing registry `normalizeQuote` (currency match, finite/non-negative rate, known provider) before it can influence a financial calculation. Driver errors are wrapped in `ShippingProviderError` with a generic, credential-free message; the original error/response body is preserved on `cause` for server-side diagnostics only.
- [x] Registered in `provider-registry.ts` `LIVE_COURIER_FACTORIES` (`() => new BobGoProvider()`). The existing provider strategy is preserved: when `BOBGO_API_KEY` is present, ONLY Bob Go is queried (MVP is NOT a silent fallback); when absent, the deterministic `MvpShippingProvider` is used (documented fallback). Runtime gating verified.
- [x] `MvpShippingProvider` preserved unchanged as the safe fallback when no live courier is configured.
- [x] Server-authoritative pricing + shipping snapshot behavior preserved — `createCheckoutIntent` still obtains the quote through the abstraction and snapshots it; `completePaidIntent` still reuses the snapshotted shipping. No checkout form or schema change.
- [x] Environment variables added to `.env.example` with accurate documented values: `BOBGO_API_KEY` (Bearer token from the Bob Go portal → Settings → API Keys) and `BOBGO_TEST_MODE` (set to `true` to route to the sandbox base URL). Both base URLs documented in comments. Removed the obsolete pending `BOBGO_API_URL` placeholder (base URLs are fixed/documented, not user-configurable). Remaining couriers kept as pending placeholders.
- [x] Per-product weight/dimensions limitation inspected and documented: the current MVP product schema does NOT carry per-variant weight or dimensions, so an accurate live quote cannot be produced yet. The adapter uses the existing documented default weight (`DEFAULT_PARCEL_WEIGHT_GRAMS = 1000` → 1 kg) and a clearly-documented conservative default parcel size (30×20×10 cm) when a parcel does not carry dimensions (Bob Go requires dimensions ≥ 1 cm to compute a rate). The resulting quote is an APPROXIMATION based on default package assumptions, NOT a verified accurate charge for the actual goods — documented prominently in the adapter, PROJECT.md, and README.md. Accurate quotes require the post-MVP per-product weight/dimensions schema addition. No weights or dimensions are invented silently; the limitation is surfaced in documentation.
- [x] Tests: 46 Bob Go tests (`features/shipping/couriers/bobgo.test.ts`) — configuration detection (env → sandbox/production URL, null when key absent), `isConfigured` true/false, country normalization (South Africa→ZA, 2-letter uppercasing, pass-through), address mapping (street2→local_area with city fallback, whitespace handling), parcel mapping (grams→kg, default dimensions, explicit dimensions preserved), payload building, response parsing for every documented shape (bare array, rates/data/results, provider_rate_requests with success/failed filtering, provider_name method fallback, empty/unrecognized shapes, non-finite/numeric-string/zero amounts, method-label fallback), `quote()` request contract (Bearer auth, JSON body, sandbox vs production URL), auth/config failures (not-configured, HTTP 401, HTTP 500), network failure, malformed (non-JSON) response, no-rates (empty + all-failed provider_rate_requests), registry integration (registration excludes MVP, MVP fallback when unconfigured, `collectQuotesFromProviders` normalizes + selects cheapest, currency-mismatch discard → ShippingQuoteError, provider failure → causes preserved, valid ZAR quote flow). Mocked `fetch`; no real credentials required. Total suite: 301 tests.
- [x] Existing functionality unchanged: Redis cart, payment providers, checkout, account, admin, search, shipping abstraction/logic — no unrelated code modified. Existing 255 tests kept passing.
- [x] Documentation: PROJECT.md, TASKS.md, README.md, `.env.example` updated; GUIDEBOOK.md untouched.
- [x] Verification: `npx prisma validate`, `npx prisma generate`, `npm test` (301 tests), `npx tsc --noEmit`, `npx eslint .` (0 errors, 4 pre-existing `_query`-unused warnings shared by all provider adapters), `npx next build` — all pass. Runtime check: registry gating confirmed — `getConfiguredShippingProviders()` returns `[mvp]` when `BOBGO_API_KEY` is unset and `[bobgo]` when it is set.
- [x] No live Bob Go sandbox call was made (no `BOBGO_API_KEY` in `.env.local`); `quote()` is verified with mocked `fetch` and the registry integration with the existing pure helpers. Live-API verification remains pending real credentials.
- [x] **Live sandbox verification (Post-MVP #4 live):** `BOBGO_API_KEY` + `BOBGO_TEST_MODE=true` were added to `.env.local`. A real, non-destructive `POST /rates` was performed against the Bob Go sandbox (`https://api.sandbox.bobgo.co.za/v2`) using the EXISTING `BobGoProvider` (no redesign/rewrite) with a safe SA test quote (Cape Town origin → Johannesburg destination, default 1 kg / 30×20×10 cm parcel, ZAR 75 subtotal). The live request returned HTTP 200 with real ZAR rates (e.g. `114.10 ZAR` via "Economy", `provider: "bobgo"`, `estimateDays: null`); the raw response used the documented `{provider_rate_requests[].responses[]}` shape, which the existing `parseBobGoRates` parsed correctly. Every live quote passed the registry's `normalizeQuote` (currency match ZAR, finite/non-negative rate, known provider, valid method) and was consumed by the checkout path — destination completeness gate, `selectCheapestQuote` (cents math), and `quoteToSnapshot`/`snapshotToRate` round-trip all verified against the real response. No API discrepancy was found against the official Bob Go docs (api-docs.bob.co.za); no application code was changed to make the live test pass. No shipments, collections, labels, orders, or any destructive/money-moving operation was performed. The API key was never printed/exposed/committed. Status: **live-sandbox-verified**; NOT production-verified (the production base URL has not been exercised, and per-product weight/dimensions remain a documented approximation).
- [x] Verification (live milestone): `npx prisma validate`, `npm test` (301 tests), `npx tsc --noEmit`, `npx eslint .` (0 errors, 4 pre-existing `_query`-unused warnings), `npx next build` — all pass. Runtime dev-server route check: storefront routes 200, admin routes 307 (auth gate), sign-in 200.
