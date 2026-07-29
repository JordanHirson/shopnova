# ShopNova — Project Architecture

## Folder Structure

```
app/              # Next.js App Router pages and API routes
components/       # Shared React components
  ui/             # shadcn/ui primitives (button, input, etc.)
features/         # Feature-specific modules (auth, products, cart, etc.)
lib/              # Utility functions, clients (supabase, prisma)
hooks/            # Custom React hooks
types/            # TypeScript type definitions
prisma/           # Prisma schema and migrations
public/           # Static assets
```

## Key Decisions

- **No `src/` directory.** All code at root for simplicity.
- **shadcn/ui Base UI** for component primitives. Custom components built on top.
- **Prisma** for type-safe database access. Schema in `prisma/schema.prisma`.
- **Supabase** for PostgreSQL database, storage, and future auth.
- **React Hook Form + Zod** for form validation — no Formik.
- **TanStack Query** for server state management — no Redux.
- **MVP scope.** Build only what's needed for a working product.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npx prisma db push` | Sync schema to DB |
| `npx prisma studio` | Open DB browser |