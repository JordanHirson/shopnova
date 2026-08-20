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
- [x] Order confirmation page (/checkout/success) — PENDING, not paid
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

## MVP Features (Future)

- [ ] Live courier API integration (Bob Go, Aramex, PUDO, Courier Guy) — abstraction in place
- [ ] Yoco + Stitch payment gateways (abstraction supports adding them)
- [ ] Redis cart store (configure REDIS_URL)
- [ ] Order management
- [ ] AI features

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
