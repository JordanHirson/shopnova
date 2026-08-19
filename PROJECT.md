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
- **Tests:** Pure cart logic is unit tested with Node's native test runner (`node --test --experimental-strip-types`). Run with `npm test`.
- **What remains:** Stripe + PayFast payment integration is still pending.

## Checkout & Order Architecture (Sprint 3, Part 2)

- **Routes:** `/checkout` (requires a non-empty cart) and `/checkout/success?orderNumber=...` (confirmation — order is PENDING, NOT paid).
- **Validation:** `lib/validations/checkout.ts` defines the Zod schema used by React Hook Form on the client and re-validated on the server before order creation. Clerk users get contact info prefilled (`useUser`); anonymous shoppers can complete checkout without signing in.
- **Authoritative pricing:** `features/checkout/actions.ts` `getCheckoutSummaryAction` re-reads product prices/inventory from PostgreSQL so the displayed order summary matches exactly what will be charged.
- **Order creation:** `lib/db/orders.ts` `createOrder` runs inside a Prisma `$transaction`:
  1. Re-reads authoritative products + inventory.
  2. Validates all requested quantities against stock.
  3. Recalculates subtotal, VAT, shipping, total from DB prices.
  4. Finds-or-creates the Customer by `@@unique([storeId, email])`.
  5. Creates the Order with a shipping snapshot + `orderNumber` (`SN-YYYYMMDD-XXXXXX`).
  6. Creates OrderItems with price snapshots from the DB.
  7. Decrements inventory with a quantity guard (`updateMany` with `quantity: { gte: item.quantity }`) so concurrent orders cannot over-sell.
- **Order number:** `generateOrderNumber` in `features/checkout/checkout-logic.ts` produces a customer-facing `SN-YYYYMMDD-XXXXXX` number — the database `id` (uuid) is never exposed.
- **VAT & shipping:** Pure functions in `features/checkout/checkout-logic.ts` — 15% South African VAT and a deterministic MVP shipping rule (free ≥ $50, flat $5 below). Shipping is separated from the UI so a courier API can replace it later.
- **Cart lifecycle:** The cart is deleted only AFTER the order transaction commits. Failed orders leave the cart intact; the error is returned to the client.
- **Tests:** 17 checkout unit tests in `features/checkout/checkout-logic.test.ts` (VAT, shipping, subtotal, total, quantity validation, insufficient inventory, order number format/uniqueness).
- **Payment status:** Orders are created with `status: PENDING`. Stripe + PayFast are NOT integrated; `checkout/success` explicitly states payment is not yet completed.

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