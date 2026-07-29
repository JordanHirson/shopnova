import { defineConfig } from "prisma/config"

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/shopnova?schema=public",
  },
  schema: "./prisma/schema.prisma",
})