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

Runs the cart business logic unit tests using Node's native test runner.

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