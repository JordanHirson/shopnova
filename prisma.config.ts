import { defineConfig } from "prisma/config"

// Prisma CLI does not load .env.local automatically.
// Load it explicitly so DATABASE_URL is available to the config.
try {
  process.loadEnvFile(".env.local")
} catch {
  try {
    process.loadEnvFile(".env")
  } catch {
    // No env file — DATABASE_URL may come from the environment (e.g. CI).
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to your .env.local file. " +
      "Example: DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
  )
}

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
  schema: "./prisma/schema.prisma",
  migrations: {
    seed: "node prisma/seed.ts",
  },
})