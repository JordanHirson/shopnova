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

## MVP Features (Future)

- [ ] Checkout (information → shipping → payment)
- [ ] Stripe + PayFast integration
- [ ] Order creation on successful payment
- [ ] Redis cart store (configure REDIS_URL)
- [ ] Order management
- [ ] AI features
