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
- **Price rule:** The client is never authoritative for price. Cart lines store a display snapshot (`unitPrice`) captured from PostgreSQL at add-to-cart time. Checkout MUST re-read authoritative prices from the database before creating an order.
- **Inventory:** The cart checks the `Inventory` model to prevent obviously invalid quantities (capping at available stock). Authoritative inventory validation happens during checkout; adding to cart does not reserve inventory.
- **Server actions:** All cart mutations run through server actions in `features/cart/actions.ts` (`addToCartAction`, `updateCartItemQuantityAction`, `removeCartItemAction`, `clearCartAction`, `getCartAction`).
- **Client bridge:** `CartProvider`/`useCart` (`features/cart/cart-context.tsx`) keeps the header badge and cart page in sync without turning the marketing layout into a client component.
- **Tests:** Pure cart logic is unit tested with Node's native test runner (`node --test --experimental-strip-types`). Run with `npm test`.
- **What remains for checkout:** information → shipping → payment flow, Stripe + PayFast, order creation on successful payment, and a Redis-backed cart store for production.

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