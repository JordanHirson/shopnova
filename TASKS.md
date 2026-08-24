# ShopNova — Task Tracker

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
- [x] Webhook API routes: `/api/webhooks/stripe`, `/api/webhooks/payfast`, `/api/webhooks/test`
- [x] Shared webhook handler (`features/payment/webhook-handler.ts`) with correct HTTP status codes
- [x] Mock hosted payment page (`/checkout/test-pay`) for local end-to-end verification
- [x] Checkout view wired to the payment-gated flow (redirect to hosted payment UI)
- [x] `/checkout/success` updated to reflect paid (CONFIRMED) vs pending status
- [x] Removed dead code: `placeOrderAction` and `createOrder` (replaced by intent-based flow)
- [x] Unit tests for payment logic (11 tests) — authoritative amount, provider selection, provider resolution
- [x] Unit tests for webhook verification (15 tests) — valid/invalid/missing signatures, failed payments, ignored events, PayFast MD5 stability
- [x] Test runner loader shim for `server-only` (`scripts/test-register.mjs` + `test-loader.mjs`)

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

## Post-MVP Roadmap (deferred — NOT required to finish the MVP)

- [ ] Live courier API integration (Bob Go, Aramex, PUDO, Courier Guy) — `ShippingProvider` seam in place
- [ ] Additional payment gateways: Yoco, Stitch (provider abstraction supports them)
- [ ] Redis cart store (configure `REDIS_URL` and swap the `CartStore` singleton)
- [ ] AI/LLM features and agents
- [ ] pgvector semantic/vector search; PostgreSQL full-text (`tsvector`) and trigram (`pg_trgm`) search
- [ ] Product federation / marketplace integrations (Shopify, Amazon, Takealot, AliExpress)
- [ ] Advanced analytics and marketing automation
- [ ] Admin search

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

## MVP Remaining

No MVP requirement is known to be unimplemented. Genuine limitations of the current build (documented, not blockers):

- [ ] In-memory cart store (`MemoryCartStore`); carts do not survive a restart and are not shared across instances
- [ ] Stripe and PayFast are unit-tested against real signature math but have never been exercised against the live Stripe API / PayFast sandbox with real credentials
- [ ] The authorized-admin journey (product/category/inventory/order mutations) has not been manually exercised with a live Clerk admin session — code paths are unit-tested and route protection was verified
- [ ] Order numbers use a random 6-digit suffix with a unique constraint; a same-day collision surfaces as a checkout error rather than being retried
