# ShopNova

**E-commerce SaaS MVP.**

ShopNova is a modern e-commerce platform built with Next.js (App Router), TypeScript, Tailwind CSS, Prisma, PostgreSQL 18 + pgvector, Clerk, and shadcn/ui.

## Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui Base UI
- **Database:** PostgreSQL 18 + pgvector
- **Database ORM:** Prisma 7
- **Authentication:** Clerk
- **Forms:** React Hook Form + Zod

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tests

```bash
npm test
```

Runs the cart, checkout, payment, and customer-account business logic + webhook verification unit tests using Node's native test runner. Covers VAT, shipping, order totals, inventory validation, payment provider selection, authoritative-amount guards, Stripe/PayFast/Test webhook signature verification, Clerk/customer association, and order-ownership authorization. No real payment credentials are required — provider adapters are tested with mock credentials and real signature math.

A small loader shim (`scripts/test-register.mjs`) maps the `server-only` marker package to an empty module so payment provider modules can be imported by the test runner outside a React server context.

## Payments

ShopNova uses hosted payment UIs so raw card data never touches the server (PCI-DSS SAQ A scope).

- **Stripe** — hosted Checkout Sessions for international orders. Webhook signature verified with `STRIPE_WEBHOOK_SECRET`.
- **PayFast** — hosted form (sandbox/production) as the default for South African orders. ITN callback verified with `PAYFAST_PASSPHRASE`.
- **Test gateway** — mock provider for local development and automated tests (registered only outside production).

Orders are created only after a server-verified payment notification. Duplicate webhooks are idempotent. Payment amounts are derived from authoritative server-side values, never client-supplied totals.

See `.env.example` for the required environment variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_TEST_MODE`, optional `TEST_PAYMENT_SECRET`). None are required to run the test suite or to use the local Test gateway.

## Customer Accounts & Order History

Authenticated customers can view their account and order history at `/account`, `/account/orders`, and `/account/orders/[orderNumber]`. Clerk is the authentication source of truth — there is no second auth system.

- **Clerk ↔ Customer link:** A nullable, unique `Customer.clerkUserId` column associates an authenticated Clerk user with their Customer row. The link is set during checkout when a signed-in shopper completes payment. Guest checkouts are not linked.
- **Security:** Every order query is scoped server-side to the authenticated customer's id. A customer cannot retrieve another customer's order by changing an order number in the URL — foreign orders return `notFound()`, identical to missing ones.
- **Auth checks:** In-page `redirect("/sign-in?redirect_url=...")` is used instead of middleware `auth.protect()` (deprecated in Clerk v7 under Next.js 16).

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