# ShopNova

**E-commerce SaaS MVP.**

ShopNova is a modern e-commerce platform built with Next.js (App Router), TypeScript, Tailwind CSS, Prisma, PostgreSQL, Clerk, and shadcn/ui.

## Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui Base UI
- **Database:** PostgreSQL (pgvector is not used by the MVP; it is a post-MVP roadmap item)
- **Database ORM:** Prisma 7
- **Authentication:** Clerk
- **Forms:** React Hook Form + Zod

## Local Development Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env.local` from `.env.example` and configure the required environment variables:

   - `DATABASE_URL` — PostgreSQL connection string (e.g. `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public`)
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — from your Clerk application
   - `CLERK_SECRET_KEY` — from your Clerk application (also used by `npm run set-admin`)

   Optional, for real payment gateway testing:

   - `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
   - `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_TEST_MODE`

   Optional:

   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis for production cart persistence (see [Cart Persistence](#cart-persistence) below). When both are set, carts are stored in Redis with a 30-day TTL. When unset in development, the cart falls back to an in-memory store. **In production these are required** — ShopNova will not silently fall back to an in-memory cart.
   - `TEST_PAYMENT_SECRET` — override for the local mock payment gateway
   - `BOBGO_API_KEY` + `BOBGO_TEST_MODE` — Bob Go live courier for real shipping quotes (see [Shipping](#shipping))
   - `YOCO_SECRET_KEY` + `YOCO_WEBHOOK_SECRET` — Yoco hosted Checkout (SA)
   - `STITCH_CLIENT_ID` + `STITCH_CLIENT_SECRET` + `STITCH_WEBHOOK_SECRET` — Stitch Pay By Bank (SA)
   - `OPENAI_API_KEY` (or `AI_API_KEY`) + optional `AI_BASE_URL` + `AI_MODEL` — AI product generation and insights (see [AI Features](#ai-features)). When unset, deterministic mock generators run so the demo always succeeds offline.

3. Push the Prisma schema and generate the client:

   ```bash
   npx prisma db push
   ```

4. Seed demo data:

   ```bash
   npm run db:seed
   ```

   Optionally, seed demo customers and orders (for the dashboard, AI insights, and abandonment feed):

   ```bash
   npm run db:seed-orders
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Tests

```bash
npm test
```

Runs the cart, checkout, payment, customer-account, admin, product-search, and shipping business logic + webhook verification unit tests using Node's native test runner (341 tests). Covers VAT, shipping, order totals, inventory validation, payment provider selection, authoritative-amount and currency guards, the local mock-payment gate, Stripe/PayFast/Test webhook signature verification, the shared Standard Webhooks verifier (Yoco `webhook-*` + Stitch/Svix `svix-*` signatures: valid/invalid/missing signatures, wrong secret, replay/timestamp tolerance, key rotation, malformed headers, body-size guard, header-prefix isolation), Yoco + Stitch provider behavior (Yoco checkout creation contract; Stitch `clientPaymentInitiationRequestCreate` GraphQL request/response contract — endpoint, Bearer auth, `Idempotency-Key`, `amount.quantity` in major units/Rand, `externalReference` = intent id, reference clamping, `redirect_uri`/`failure_redirect_uri` appending, GraphQL `errors[]`, missing id/url, refuses-when-not-configured; `centsToStitchMajorUnits`/`majorUnitsToCents` round-trip, `stitchReference`, `buildStitchRedirectUrl`; webhook event parsing, failed/pending states, wrong-provider intents, duplicate idempotency keys, malformed responses, the provider-match boundary), Clerk/customer association, order-ownership authorization, admin role matching, admin order-status rules (PENDING/REFUNDED rejected to preserve payment security), storefront product search (name/description/sku/category matching, case-insensitive, partial matches, archived exclusion, empty/invalid queries, ordering, limits), the Redis cart store (write/read round trip, update, remove, clear, empty/missing, TTL configuration, serialization/deserialization, shopper isolation, configuration detection, production config failure, credential-free error handling), and the shipping provider abstraction (provider contract, quote normalization, provider selection, successful quote, provider failure, invalid/malformed responses, missing configuration, currency mismatch, shipping-cost calculation, checkout total integration, protection against client-supplied shipping manipulation). No real payment, Redis, or courier credentials are required — provider adapters are tested with mock credentials and real signature math, the Redis cart store is tested with a fake `RedisLike` client, and the shipping registry is tested with a `FakeShippingProvider` + extracted pure helpers.

A small loader shim (`scripts/test-register.mjs`) maps the `server-only` marker package to an empty module so payment provider modules can be imported by the test runner outside a React server context.

## Payments

ShopNova uses hosted payment UIs so raw card data never touches the server (PCI-DSS SAQ A scope).

- **Stripe** — hosted Checkout Sessions for international orders. Webhook signature verified with `STRIPE_WEBHOOK_SECRET`.
- **PayFast** — hosted form (sandbox/production) as the default for South African orders. ITN callback verified with `PAYFAST_PASSPHRASE`.
- **Yoco** — hosted Checkout API (`payments.yoco.com/api`) for South African orders. Webhook verified with the Standard Webhooks scheme (`webhook-*` headers, `YOCO_WEBHOOK_SECRET`). Implemented per the official public API contract and unit-tested against real signature math; **not** exercised against the live Yoco API (no credentials in this environment), so it is not marked production-verified. Registered and selectable behind the abstraction when `YOCO_SECRET_KEY` + `YOCO_WEBHOOK_SECRET` are set; checkout routing still defaults to PayFast (SA) / Stripe (international).
- **Stitch** — hosted payment-initiation via the official `clientPaymentInitiationRequestCreate` GraphQL mutation (`POST https://api.stitch.money/graphql`, Bearer client token via the OAuth 2.0 client-credentials flow with the `client_paymentrequest` scope, `Idempotency-Key` header). The mutation sends `amount.quantity` in MAJOR units (Rand) with `externalReference` set to the CheckoutIntent id (webhook correlation key), `payerReference`/`beneficiaryReference` clamped to the documented limits, `payerInformation.payerId`, and `expireAt`; the response `paymentInitiationRequest { id url }` provides the hosted url (with `redirect_uri`/`failure_redirect_uri` appended). Webhook verified with Svix/Standard Webhooks (`svix-*` headers, `STITCH_WEBHOOK_SECRET`). Implemented per the official public API contract and unit-tested against real signature math (mocked `fetch`); **not** exercised against the live Stitch sandbox (no credentials in this environment), so it is not marked production-verified. Registered and selectable behind the abstraction when `STITCH_CLIENT_ID` + `STITCH_CLIENT_SECRET` + `STITCH_WEBHOOK_SECRET` are all set; checkout routing still defaults to PayFast (SA) / Stripe (international).
- **Test gateway** — mock provider for local development and automated tests (registered only outside production). Its completion path (`completeTestPaymentAction`, `/checkout/test-pay`) additionally requires that the server is outside production, the checkout intent's provider is `test`, and the intent belongs to the calling shopper.

Orders are created only after a server-verified payment notification. Duplicate webhooks are idempotent. Payment amounts are derived from authoritative server-side values, never client-supplied totals: the gateway's verified charge must match the server-computed intent amount **and** currency, or the notification is rejected. Webhook processing is provider-specific: a verified notification from one gateway cannot complete a `CheckoutIntent` created for a different gateway (enforced in `completePaidIntent` via `isProviderMatch`, in addition to each route being provider-scoped and each adapter verifying its own signature).

Archived products can never be ordered — archived cart lines are marked unavailable, excluded from the cart subtotal, and rejected at checkout.

See `.env.example` for the required environment variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_TEST_MODE`, optional `TEST_PAYMENT_SECRET`, optional `YOCO_SECRET_KEY` + `YOCO_WEBHOOK_SECRET`, optional `STITCH_CLIENT_ID` + `STITCH_CLIENT_SECRET` + `STITCH_WEBHOOK_SECRET`). None are required to run the test suite or to use the local Test gateway.

## Cart Persistence

Carts are stored server-side behind a provider-agnostic `CartStore` interface (`features/cart/cart-store.ts`). The active backend is chosen at runtime:

- **`RedisCartStore`** (`features/cart/redis-cart-store.ts`) — production store backed by **Upstash Redis** (REST API), the guidebook's chosen cache and the recommended Redis provider for Next.js/Vercel serverless. Used when both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set.
- **`MemoryCartStore`** — development-only fallback (in-memory `Map` on `globalThis`) that survives page navigation while the dev server runs. Not production-ready (no cross-instance sharing, no restart survival).

### Configuring Upstash Redis

1. Create a Redis database at [console.upstash.com](https://console.upstash.com/redis).
2. Copy the **REST URL** and **REST Token** from your database page.
3. Add them to `.env.local`:

   ```
   UPSTASH_REDIS_REST_URL=https://<your-db>.upstash.io
   UPSTASH_REDIS_REST_TOKEN=<your-token>
   ```

### Behavior

- **30-day TTL** (`CART_TTL_SECONDS = 60 * 60 * 24 * 30`), refreshed on every cart write via an atomic `SET ... EX` call so an active shopper's cart never expires out from under them.
- **Key design:** `cart:<shopper-id>` — namespaced, per-shopper, no personal data (the shopper id is `user:<clerkUserId>` or `anon:<uuid>`). Carts from different shoppers cannot collide.
- **Serialization:** only the cart data needed by the cart architecture is stored (no full Prisma Product records). Money is stored as the existing number snapshot captured at add-to-cart time; checkout re-reads authoritative prices from PostgreSQL, so the persisted snapshot is display-only.
- **Production guard:** if production starts without Redis credentials, ShopNova throws a `CartConfigurationError` with an actionable message — it never silently falls back to an in-memory cart (which would silently lose cart persistence). The store is resolved lazily on first use so `next build` does not require credentials at build time.
- **Error handling:** if Redis is unavailable during an operation, `RedisCartStore` throws a `CartStoreError` with a generic, credential-free message (the original driver error is preserved on `cause` for server-side debugging). It never silently pretends the operation succeeded.
- **Concurrency limitation:** cart mutations follow a load → mutate → save cycle. The Redis `SET ... EX` write is atomic, but the read-modify-write window is not — two simultaneous mutations for the same shopper could race (last write wins). This matches the previous in-memory behavior and is acceptable for a single-shopper cart; distributed locking is intentionally not added.

## Shipping

Shipping rates are obtained server-side through a provider-agnostic `ShippingProvider` abstraction (`features/shipping/shipping-provider.ts`), mirroring the payment provider pattern. Checkout business logic never depends on a concrete courier.

- **Abstraction:** `ShippingProvider` interface (`id`, `isConfigured()`, `quote(request)`), `ShippingQuoteRequest`/`ShippingQuote` types, and `ShippingProviderError`. The application depends on the abstraction, not on Bob Go/Aramex/PUDO/The Courier Guy.
- **Pure logic** (`features/shipping/shipping-logic.ts`): destination completeness, address normalization, parcel/request building, `normalizeQuote` (defensive validation of provider responses), `selectCheapestQuote`, and quote↔snapshot round-trip.
- **Registry** (`features/shipping/provider-registry.ts`, server-only): fetches quotes from all configured providers in parallel (`Promise.allSettled`, per the guidebook), validates/normalizes each response, and returns the valid quotes. `getAuthoritativeShippingQuote` returns the cheapest valid quote.
- **Provider strategy:** when one or more live couriers are configured, ONLY live couriers are queried — the deterministic MVP provider is NOT a silent fallback (a failed live quote is never replaced with an arbitrary price). When no live courier is configured, the deterministic `MvpShippingProvider` (free ≥ R50, flat R5 below) is used as the documented deliberate fallback.
- **Server-authoritative quotes:** the client is never authoritative for the shipping rate, provider, quote, or order total. `createCheckoutIntent` obtains the quote from the validated destination, snapshots it on the `CheckoutIntent`, and computes the authoritative total. `completePaidIntent` reuses the snapshotted shipping so the order reproduces exactly what was charged. `getCheckoutSummaryAction` uses the abstraction when a complete destination is supplied; the checkout view re-fetches the summary once the address is filled.
- **Client manipulation prevention:** the checkout form has no shipping-amount field (Zod strips any client-supplied shipping keys); the order total is computed from the server subtotal + server quote rate + server VAT.
- **Failure behavior:** if every configured provider fails or returns no valid quote, checkout surfaces a safe user-facing error and creates no order with an incorrect amount. Forged/malformed provider responses are discarded before influencing a financial calculation.
- **Order snapshot:** `Order.shipping` + `Order.shippingProvider` + `Order.shippingMethod` are captured at order time; historical orders are never retroactively changed when rates change.
- **Live courier status:** **Bob Go** (the guidebook's multi-courier API) is implemented and registered (`features/shipping/couriers/bobgo.ts`) — it is selected only when `BOBGO_API_KEY` is present. It uses the official public REST API (api-docs.bob.co.za): Bearer-token auth, `POST /rates`, sandbox (`https://api.sandbox.bobgo.co.za/v2`) via `BOBGO_TEST_MODE=true` and production (`https://api.bobgo.co.za/v2`) otherwise. It parses every documented response shape (a bare array, `{rates|data|results}`, `{provider_rate_requests[].responses[]}`) and maps each rate to a `ShippingQuote`. Implemented per the official public API contract, unit-tested with mocked `fetch`, and **live-sandbox-verified**: a real non-destructive `POST /rates` to the Bob Go sandbox (Cape Town → Johannesburg, default 1 kg / 30×20×10 cm parcel, ZAR subtotal) returned real ZAR rates that normalized correctly into `ShippingQuote` and flowed through the registry + checkout path (destination gate, `selectCheapestQuote`, snapshot round-trip). No API discrepancy was found; no application code was changed for the live test. NOT marked production-verified (the production base URL has not been exercised). Aramex, PUDO, and The Courier Guy adapters remain pending official API contracts/credentials.
- **Per-product weight/dimensions:** since Post-MVP #5, the product schema carries nullable per-product `weightGrams` and `lengthCm`/`widthCm`/`heightCm` fields (admin-editable on the product form). The shipping abstraction builds one parcel per purchased unit carrying the product's actual weight/dimensions when present, so a Bob Go live quote now reflects the real goods. Products without physical metadata continue to receive the documented conservative fallback (1 kg / 30×20×10 cm) — the fallback is deterministic and applied per-field. Zero values are treated as "not specified" (fallback); negative and non-integer values are rejected by the product validation schema.
- **Environment variables:** `SHIPPING_ORIGIN_*` (optional, SA defaults) configure the dispatch origin. `BOBGO_API_KEY` (Bearer token) + `BOBGO_TEST_MODE` (sandbox toggle) configure the Bob Go live courier; remaining courier credential variables are documented in `.env.example` as pending placeholders. Courier secrets are server-only and never reach the client.

See `.env.example` for the shipping-related variables. None are required to run the test suite or to use the deterministic MVP provider.

## Customer Accounts & Order History

Authenticated customers can view their account and order history at `/account`, `/account/orders`, and `/account/orders/[orderNumber]`. Clerk is the authentication source of truth — there is no second auth system.

- **Clerk ↔ Customer link:** A nullable, unique `Customer.clerkUserId` column associates an authenticated Clerk user with their Customer row. The link is set during checkout when a signed-in shopper completes payment. Guest checkouts are not linked.
- **Security:** Every order query is scoped server-side to the authenticated customer's id. A customer cannot retrieve another customer's order by changing an order number in the URL — foreign orders return `notFound()`, identical to missing ones.
- **Auth checks:** In-page `redirect("/sign-in?redirect_url=...")` is used instead of middleware `auth.protect()` (deprecated in Clerk v7 under Next.js 16).

## Admin Dashboard & Store Management

The admin area lives at `/dashboard/*` and lets the store owner operate ShopNova without touching the database. It is protected server-side on every page and every server action — a normal customer cannot access or invoke admin functionality.

### Granting admin access

An admin is a Clerk user whose `privateMetadata.role === "admin"`. `privateMetadata` is server-only (not forgeable in the browser). Grant or revoke it with:

```bash
npm run set-admin -- <clerkUserId>            # grant admin
npm run set-admin -- <clerkUserId> --remove   # revoke admin
```

This requires `CLERK_SECRET_KEY` in your `.env.local`. You can also set it via the Clerk Dashboard → Users → user → Private metadata → `{ "role": "admin" }`.

### What's included

- **Dashboard (`/dashboard`)** — KPI overview: products, categories, customers, orders, pending orders, low-stock count, and recent orders.
- **Products (`/dashboard/products`)** — create, edit, archive (soft-delete), and restore products. Archiving hides a product from the storefront while keeping historical order records intact (`OrderItem` uses `onDelete: Restrict`).
- **Categories (`/dashboard/categories`)** — create, edit, and delete categories. Deletion is blocked with a clear error when products still reference the category.
- **Inventory (`/dashboard/inventory`)** — view stock levels and low-stock thresholds, update quantities and thresholds.
- **Orders (`/dashboard/orders`, `/dashboard/orders/[orderNumber]`)** — view orders and order details, update fulfillment status. Payment status is read-only and stays webhook-driven — an admin UI action can never mark an order paid or refunded.
- **Customers (`/dashboard/customers`, `/dashboard/customers/[customerId]`)** — view customers and their order history. No auth identifiers are exposed.
- **Federation (`/dashboard/federation`)** — link external stores, import their products with markup, and run syncs (see [Catalog Federation](#catalog-federation)).
- **Settings (`/dashboard/settings`)** — customize the storefront theme and colors (see [Storefront Theming](#storefront-theming)).
- **AI Operations Copilot** (on the order detail page) — AI order triage and one-click fulfilment + courier booking (see [AI Features](#ai-features)).
- **Ask ShopNova** (top-bar button) — conversational AI sales insights (see [AI Features](#ai-features)).
- **Active Carts & Recovery** (on the dashboard home page) — abandoned cart feed with recovery email trigger (see [AI Features](#ai-features)).

### Security

- Every admin page calls `requireAdminOrRedirect()`; every admin server action calls `requireAdmin()` before any data access or mutation.
- Middleware provides a lightweight auth gate (redirect unauthenticated users to sign-in); role authorization happens in-page/server-action because `privateMetadata` is not in the JWT.
- A signed-in non-admin who navigates to `/dashboard` is redirected to `/dashboard/unauthorized`.
- The storefront "Admin" link is a UI convenience only (rendered for admins) — it is not the security boundary.

## Product Search

Shoppers can search the storefront product catalog from a search box in the storefront header. Search results live at `/products?search=<query>` and are URL-addressable (bookmarkable/shareable).

- **What's searched:** product name, description, SKU, and category name — case-insensitive, partial/substring matching.
- **Where it runs:** filtering is performed by PostgreSQL via Prisma (`ILIKE` substring match). The full catalog is never shipped to the browser. Queries are parameterized (no raw SQL).
- **Archived products:** never returned by search (the same `archived: false` filter used by all storefront queries).
- **Results:** ordered by name ascending, capped at 24 results. Reuses the existing product card grid. Shows a "no matches" empty state when nothing matches.
- **Empty/invalid query:** a missing, blank, or over-long `search` param falls back to browsing all products rather than showing a zero-result search.
- **Search UI:** a small form in the storefront header (`components/storefront/search-box.tsx`) with an accessible label and `role="search"`, working on desktop and mobile.
- **Search contract:** the matching behavior is defined in a pure, unit-tested module (`features/search/search-logic.ts`) that the database query mirrors, so the search semantics are verified without needing a live database.

### Advanced search (post-MVP roadmap)

The following are deliberately deferred and not part of the MVP: PostgreSQL full-text search (`tsvector`/`tsquery` + GIN indexes), trigram indexes (`pg_trgm`) for fuzzy/typo-tolerant matching, pgvector semantic/vector search, AI/LLM search, embeddings, personalized search, and catalog federation search. The current `ILIKE` substring implementation is fast and sufficient for the MVP catalog size.

## Storefront Theming

The store owner can customize the storefront's look from the dashboard at `/dashboard/settings` (admin-gated). Changes apply to the storefront immediately after saving.

- **Presets:** three selectable themes — Modern Slate, Warm Artisan, Neon Cyber — each with default primary + accent colors. A custom color picker overrides the preset colors.
- **Application:** the selected colors are applied to the storefront via `:root` CSS variables (`--primary`, `--accent`) so the entire storefront re-skins instantly. The dashboard is unaffected.
- **Schema:** `Store.themePreset`, `Store.primaryColor`, `Store.accentColor` (all nullable, additive migration). Existing stores keep the default theme.
- **Source of truth:** `lib/theme.ts` centralizes the presets and color normalization; the dashboard customizer and storefront layout both import from it.

## Catalog Federation

The admin can link external stores (Shopify, Amazon, Takealot, AliExpress, WooCommerce, CSV) at `/dashboard/federation`, import their products, apply a markup, and resell them with auto-sync.

- **Link:** create a federation source (name, source type, target category, markup rule — percentage or fixed, sync interval). The link stores its config in a JSON column.
- **Sync:** running a sync pages through the upstream products, applies the markup rule to each price, and upserts them as `Product` rows tied to the link (matched by `externalId`). Re-syncs update existing products so upstream price changes flow through; orphaned products left by a removed source are re-linked instead of duplicated. Each run is recorded as a `FederationSyncRun` (RUNNING → SUCCESS/FAILED with created/updated counts).
- **Removal:** deleting a link hard-deletes its products that have never been ordered (images/inventory cascade), and archives + unlinks products on historical orders (preserving order history, mirroring the soft-delete policy). Everything runs in a single transaction.
- **Mock sources:** the MVP uses deterministic mock catalogs (`lib/federation/mock-sources.ts`) for each source type so the demo runs with no external credentials or network. The `UpstreamProduct` shape mirrors a real source client, so swapping the mock for real per-source connectors later requires no changes to the sync runner.
- **Security:** every page/action authorizes via `requireAdmin()`; the target category is verified to belong to the default store before a link is created.

## AI Features

ShopNova includes AI-powered merchandising and operations features. All AI routes are admin-gated and use a provider-agnostic OpenAI-compatible Chat Completions client (no new dependency — native `fetch`). When no API key is configured, deterministic mock generators run so the demo always succeeds instantly offline.

- **AI Product Generation (`POST /api/ai/generate-product`):** accepts product keywords and/or an image, returns structured JSON (title, description, tags, suggested price, category) that the admin product form autofills. The admin product form has an "AI Autofill" button. Vision image input is supported when a base64 image is supplied.
- **AI Insights / Ask ShopNova (`POST /api/ai/insights`):** answers merchant questions such as "Which collections drove growth this month?" by aggregating order-item revenue by category and comparing the current month against the previous one. Returns a natural-language summary plus supporting mini metric bars. A top-bar "Ask ShopNova" button in the dashboard opens a slide-over panel with suggested questions and a free-text input.
- **AI Order Triage & Fulfilment:** the admin order detail page shows an "AI Operations Copilot" card that triages the order (fraud risk, stock verification, auto-calculated weight & dimensions, cheapest-courier recommendation via the existing shipping registry). An "AI Fulfill & Book Courier" button advances the order to PROCESSING and generates a tracking number + shipping label. When no live courier is configured, a deterministic simulated recommendation is returned (clearly labelled).
- **Abandoned Cart Recovery:** the dashboard home page shows an "Active Carts & Recovery" feed derived deterministically from the store's real customers and products. A "Trigger Recovery Email" button builds the exact recovery email (personalized subject, abandoned items, 10% discount link) and shows a live preview. In production this would hand off to Resend/Customer.io; for the MVP it returns the rendered preview.

### AI environment variables

- `OPENAI_API_KEY` (preferred) or `AI_API_KEY` (generic alias) — the API key. When neither is set, deterministic mock generators run.
- `AI_BASE_URL` — override the OpenAI-compatible endpoint (e.g. Google Gemini, Groq, OpenRouter).
- `AI_MODEL` — override the model name.

See `.env.example` for provider-specific examples (OpenAI, Google Gemini, Groq, OpenRouter).

## Database Setup

```bash
npx prisma db push   # Sync schema to database
npm run db:seed      # Seed demo data
```

## Seeding Demo Data

The seed script (`prisma/seed.ts`) creates reproducible development/demo data:

- **1 store** — ShopNova
- **5 categories** — Electronics, Home & Living, Fashion, Beauty, Sports & Outdoors
- **16 products** — distributed across categories, each with a name, slug, description, price, optional compare-at price, SKU, category, and store
- **Product images** — stable public image URLs (Unsplash)
- **Inventory** — each product gets a quantity and low-stock threshold

### How to run

```bash
npm run db:seed
```

Or via Prisma:

```bash
npx prisma db seed
```

### Is it safe to run again?

Yes. The seed is **idempotent** — it uses `upsert` operations keyed on unique slugs/SKUs, so running it multiple times will not create duplicate stores, categories, products, or inventory records. It never deletes or modifies existing application data.

> **Note:** This seed is intended for **development/demo purposes only**. It is not a production data migration.

## Seeding Demo Orders

The main seed creates the store, categories, products, and inventory — but NO customers or orders. The demo-orders seed (`prisma/seed-orders.ts`) fills that gap so the dashboard's "Recent orders" table, the AI insights growth %, and the Active Carts & Recovery feed all have realistic data.

- **6 customers** — also used by the abandonment feed.
- **~40 orders** — spread across THIS month and LAST month, weighted so Electronics leads growth (~+42–50%), followed by Fashion — exactly the story the AI insights demo tells.

### How to run

```bash
npm run db:seed-orders
```

Requires `npm run db:seed` to have been run first (it needs the store, categories, and products).

### Is it safe to run again?

Yes. It is **idempotent** — it upserts customers by `[storeId, email]` and skips orders whose `orderNumber` already exists. It never deletes existing orders/customers. Re-running after a month boundary simply adds more orders to the new "this month".

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Start the production server (after `build`) |
| `npm run lint` | Run ESLint |
| `npm test` | Run the unit test suite (Node native test runner) |
| `npm run db:seed` | Seed demo store, categories, products, and inventory |
| `npm run db:seed-orders` | Seed demo customers and orders (run after `db:seed`) |
| `npm run set-admin -- <clerkUserId>` | Grant the admin role on a Clerk user |
| `npm run set-admin -- <clerkUserId> --remove` | Revoke the admin role on a Clerk user |
| `npx prisma db push` | Sync the Prisma schema to the database |
| `npx prisma db seed` | Run the Prisma seed (equivalent to `npm run db:seed`) |
| `npx prisma generate` | Generate the Prisma Client |
| `npx prisma validate` | Validate the Prisma schema |
| `npx prisma studio` | Open Prisma Studio (database browser) |
| `npx prisma migrate dev` | Create and apply a new migration (development) |
| `npx prisma migrate deploy` | Apply pending migrations (production) |
| `npx tsc --noEmit` | Type-check the project without emitting files |