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

## MVP Features (Future)

- [ ] Stripe + PayFast payment integration
- [ ] Payment processing (orders are PENDING until paid)
- [ ] Courier/shipping API integration (currently deterministic MVP rate)
- [ ] Redis cart store (configure REDIS_URL)
- [ ] Order management
- [ ] AI features
