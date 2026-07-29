<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## ShopNova Conventions

- **No `src/` directory.** All code lives at the project root under `app/`, `components/`, `features/`, `lib/`, `hooks/`, `types/`.
- **shadcn/ui** components go in `components/ui/`. Custom components go in `components/` or `features/`.
- **Prisma schema** lives in `prisma/schema.prisma`.
- **Supabase client** is configured in `lib/supabase.ts`.
- **React Hook Form + Zod** for all forms. Resolvers via `@hookform/resolvers`.
- **TanStack Query** for server state. No Redux.
- **No authentication libraries yet.** Will be added later.
- **MVP scope only.** Do not build enterprise features.