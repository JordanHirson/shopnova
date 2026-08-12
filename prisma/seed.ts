/**
 * ShopNova — Prisma Seed Script
 *
 * Creates reproducible demo data for local development:
 *   - 1 store
 *   - 5 categories
 *   - 16 products
 *   - product images
 *   - inventory records
 *
 * The seed is idempotent — safe to run multiple times.
 * It does not delete or modify any existing application data.
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// ── Environment ───────────────────────────────
// Prisma CLI loads .env files before spawning this script,
// but we load it explicitly here too so the script
// also works when run directly (node prisma/seed.ts).

try {
  process.loadEnvFile(".env.local")
} catch {
  try {
    process.loadEnvFile(".env")
  } catch {
    console.warn(
      "No .env.local or .env found. Using DATABASE_URL from environment."
    )
  }
}

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:newpostgres@localhost:5432/shopnova?schema=public"

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

// ── Types ─────────────────────────────────────

interface StoreSeed {
  name: string
  slug: string
  description: string
}

interface CategorySeed {
  name: string
  slug: string
  description: string
}

interface ProductSeed {
  name: string
  slug: string
  description: string
  price: string
  compareAtPrice?: string
  sku: string
  categorySlug: string
  quantity: number
  lowStockThreshold: number
  imageUrl: string
  imageAlt: string
}

// ── Seed data ─────────────────────────────────

const STORE: StoreSeed = {
  name: "ShopNova",
  slug: "shopnova",
  description:
    "A modern e-commerce storefront offering curated products across electronics, home, fashion, beauty, and outdoor categories.",
}

const CATEGORIES: CategorySeed[] = [
  {
    name: "Electronics",
    slug: "electronics",
    description:
      "Headphones, cameras, smart devices, and more for your digital life.",
  },
  {
    name: "Home & Living",
    slug: "home-living",
    description:
      "Furniture, decor, and everyday essentials to make your home comfortable.",
  },
  {
    name: "Fashion",
    slug: "fashion",
    description:
      "Footwear, accessories, and apparel to express your personal style.",
  },
  {
    name: "Beauty",
    slug: "beauty",
    description:
      "Skincare, fragrance, and self-care essentials for your daily routine.",
  },
  {
    name: "Sports & Outdoors",
    slug: "sports-outdoors",
    description:
      "Gear and equipment for an active, outdoor lifestyle.",
  },
]

const PRODUCTS: ProductSeed[] = [
  // ── Electronics (4) ─────────────────────────
  {
    name: "Wireless Noise-Cancelling Headphones",
    slug: "wireless-noise-cancelling-headphones",
    description:
      "Premium over-ear headphones with active noise cancellation, 30-hour battery life, and plush memory-foam ear cushions for all-day comfort.",
    price: "199.99",
    compareAtPrice: "249.99",
    sku: "SN-ELEC-001",
    categorySlug: "electronics",
    quantity: 25,
    lowStockThreshold: 5,
    imageUrl:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop&q=80",
    imageAlt: "Wireless noise-cancelling headphones",
  },
  {
    name: "Smart Fitness Watch",
    slug: "smart-fitness-watch",
    description:
      "Track workouts, heart rate, sleep, and notifications with this water-resistant smartwatch featuring a bright AMOLED display and 10-day battery.",
    price: "149.99",
    compareAtPrice: "179.99",
    sku: "SN-ELEC-002",
    categorySlug: "electronics",
    quantity: 40,
    lowStockThreshold: 8,
    imageUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop&q=80",
    imageAlt: "Smart fitness watch with watch face",
  },
  {
    name: "4K Mirrorless Digital Camera",
    slug: "4k-mirrorless-digital-camera",
    description:
      "Capture stunning 4K video and 24MP photos with this compact mirrorless camera, featuring fast autofocus and in-body image stabilization.",
    price: "599.99",
    compareAtPrice: "699.99",
    sku: "SN-ELEC-003",
    categorySlug: "electronics",
    quantity: 12,
    lowStockThreshold: 3,
    imageUrl:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&h=600&fit=crop&q=80",
    imageAlt: "4K mirrorless digital camera",
  },
  {
    name: "Portable Bluetooth Speaker",
    slug: "portable-bluetooth-speaker",
    description:
      "Crisp 360° sound in a rugged, waterproof design. 12 hours of playtime on a single charge, perfect for home or on the go.",
    price: "79.99",
    compareAtPrice: "99.99",
    sku: "SN-ELEC-004",
    categorySlug: "electronics",
    quantity: 55,
    lowStockThreshold: 10,
    imageUrl:
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=600&fit=crop&q=80",
    imageAlt: "Portable bluetooth speaker",
  },

  // ── Home & Living (4) ───────────────────────
  {
    name: "Modern Lounge Chair",
    slug: "modern-lounge-chair",
    description:
      "A comfortable mid-century inspired lounge chair with solid wood frame, curved backrest, and premium upholstery fabric.",
    price: "349.99",
    compareAtPrice: "399.99",
    sku: "SN-HOME-001",
    categorySlug: "home-living",
    quantity: 8,
    lowStockThreshold: 2,
    imageUrl:
      "https://images.unsplash.com/photo-1503602642458-232111445657?w=600&h=600&fit=crop&q=80",
    imageAlt: "Modern lounge chair",
  },
  {
    name: "Ceramic Table Lamp",
    slug: "ceramic-table-lamp",
    description:
      "A warm, minimalist ceramic table lamp with a linen shade — perfect for reading nooks, bedside tables, and cozy corners.",
    price: "129.99",
    compareAtPrice: "149.99",
    sku: "SN-HOME-002",
    categorySlug: "home-living",
    quantity: 18,
    lowStockThreshold: 4,
    imageUrl:
      "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&h=600&fit=crop&q=80",
    imageAlt: "Ceramic table lamp",
  },
  {
    name: "Stoneware Coffee Mug",
    slug: "stoneware-coffee-mug",
    description:
      "A hand-finished stoneware mug with a comfortable handle and 12oz capacity. Dishwasher and microwave safe.",
    price: "24.99",
    sku: "SN-HOME-003",
    categorySlug: "home-living",
    quantity: 100,
    lowStockThreshold: 20,
    imageUrl:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&h=600&fit=crop&q=80",
    imageAlt: "Stoneware coffee mug",
  },
  {
    name: "Decorative Glass Vase",
    slug: "decorative-glass-vase",
    description:
      "An elegant hand-blown glass vase that adds a touch of sophistication to any room. Ideal for fresh or dried flowers.",
    price: "49.99",
    sku: "SN-HOME-004",
    categorySlug: "home-living",
    quantity: 30,
    lowStockThreshold: 6,
    imageUrl:
      "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=600&h=600&fit=crop&q=80",
    imageAlt: "Decorative glass vase",
  },

  // ── Fashion (3) ─────────────────────────────
  {
    name: "Classic Running Sneakers",
    slug: "classic-running-sneakers",
    description:
      "Lightweight, breathable running sneakers with responsive cushioning and a classic silhouette that pairs well with anything.",
    price: "89.99",
    compareAtPrice: "110.00",
    sku: "SN-FASH-001",
    categorySlug: "fashion",
    quantity: 35,
    lowStockThreshold: 7,
    imageUrl:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop&q=80",
    imageAlt: "Classic red running sneakers",
  },
  {
    name: "Everyday Canvas Backpack",
    slug: "everyday-canvas-backpack",
    description:
      "A durable canvas backpack with padded laptop sleeve, multiple pockets, and a water-resistant finish. Perfect for work, school, or travel.",
    price: "64.99",
    compareAtPrice: "79.99",
    sku: "SN-FASH-002",
    categorySlug: "fashion",
    quantity: 22,
    lowStockThreshold: 5,
    imageUrl:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop&q=80",
    imageAlt: "Everyday canvas backpack",
  },
  {
    name: "Polarized Aviator Sunglasses",
    slug: "polarized-aviator-sunglasses",
    description:
      "Classic aviator sunglasses with polarized UV400 lenses, stainless steel frame, and a comfortable nose bridge.",
    price: "59.99",
    sku: "SN-FASH-003",
    categorySlug: "fashion",
    quantity: 45,
    lowStockThreshold: 9,
    imageUrl:
      "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&h=600&fit=crop&q=80",
    imageAlt: "Polarized aviator sunglasses",
  },

  // ── Beauty (2) ──────────────────────────────
  {
    name: "Hydrating Face Serum",
    slug: "hydrating-face-serum",
    description:
      "A lightweight, vitamin-C enriched serum that deeply hydrates and brightens skin. Suitable for all skin types.",
    price: "39.99",
    compareAtPrice: "49.99",
    sku: "SN-BEAU-001",
    categorySlug: "beauty",
    quantity: 60,
    lowStockThreshold: 12,
    imageUrl:
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=600&fit=crop&q=80",
    imageAlt: "Hydrating face serum bottle",
  },
  {
    name: "Signature Eau de Parfum",
    slug: "signature-eau-de-parfum",
    description:
      "A sophisticated unisex fragrance with notes of bergamot, jasmine, and sandalwood. Long-lasting 50ml eau de parfum.",
    price: "79.99",
    compareAtPrice: "95.00",
    sku: "SN-BEAU-002",
    categorySlug: "beauty",
    quantity: 28,
    lowStockThreshold: 6,
    imageUrl:
      "https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&h=600&fit=crop&q=80",
    imageAlt: "Signature eau de parfum bottle",
  },

  // ── Sports & Outdoors (3) ───────────────────
  {
    name: "Insulated Stainless Bottle",
    slug: "insulated-stainless-bottle",
    description:
      "Keeps drinks cold for 24 hours or hot for 12. Made from 18/8 stainless steel with a leak-proof lid and powder-coated finish.",
    price: "34.99",
    compareAtPrice: "39.99",
    sku: "SN-SPOR-001",
    categorySlug: "sports-outdoors",
    quantity: 75,
    lowStockThreshold: 15,
    imageUrl:
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=600&fit=crop&q=80",
    imageAlt: "Insulated stainless water bottle",
  },
  {
    name: "Non-Slip Yoga Mat",
    slug: "non-slip-yoga-mat",
    description:
      "A 6mm premium yoga mat with non-slip texture, cushioning support, and a carrying strap. Perfect for yoga, pilates, and stretching.",
    price: "49.99",
    sku: "SN-SPOR-002",
    categorySlug: "sports-outdoors",
    quantity: 32,
    lowStockThreshold: 7,
    imageUrl:
      "https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=600&h=600&fit=crop&q=80",
    imageAlt: "Non-slip yoga mat",
  },
  {
    name: "Trail Running Shoes",
    slug: "trail-running-shoes",
    description:
      "All-terrain trail running shoes with aggressive grip, cushioned midsole, and breathable, quick-drying upper.",
    price: "119.99",
    compareAtPrice: "139.99",
    sku: "SN-SPOR-003",
    categorySlug: "sports-outdoors",
    quantity: 20,
    lowStockThreshold: 4,
    imageUrl:
      "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&h=600&fit=crop&q=80",
    imageAlt: "Trail running shoes",
  },
]

// ── Main ──────────────────────────────────────

async function main() {
  const startedAt = Date.now()

  console.log("🌱 Seeding ShopNova demo data…\n")

  // ── Store ───────────────────────────────────
  const store = await prisma.store.upsert({
    where: { slug: STORE.slug },
    update: {
      name: STORE.name,
      description: STORE.description,
    },
    create: {
      name: STORE.name,
      slug: STORE.slug,
      description: STORE.description,
    },
  })
  console.log(`✅ Store: "${store.name}" (slug: ${store.slug})`)

  // ── Categories ──────────────────────────────
  let categoryCount = 0
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug: cat.slug } },
      update: {
        name: cat.name,
        description: cat.description,
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        storeId: store.id,
      },
    })
    categoryCount++
    console.log(`  ✅ Category: "${cat.name}" (slug: ${cat.slug})`)
  }

  // Build a map of category by slug for product assignment
  const categories = await prisma.category.findMany({
    where: { storeId: store.id },
  })
  const categoryBySlug = new Map(
    categories.map((c) => [c.slug, c] as const)
  )

  // ── Products, images, inventory ─────────────
  let productCount = 0
  let imageCount = 0
  let inventoryCount = 0

  for (const p of PRODUCTS) {
    const category = categoryBySlug.get(p.categorySlug)
    if (!category) {
      console.warn(
        `  ⚠️ Skipping "${p.name}" — unknown category "${p.categorySlug}"`
      )
      continue
    }

    // Upsert product (idempotent)
    const product = await prisma.product.upsert({
      where: { storeId_slug: { storeId: store.id, slug: p.slug } },
      update: {
        name: p.name,
        description: p.description,
        price: p.price,
        compareAtPrice: p.compareAtPrice ?? null,
        sku: p.sku,
        categoryId: category.id,
      },
      create: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        compareAtPrice: p.compareAtPrice ?? null,
        sku: p.sku,
        categoryId: category.id,
        storeId: store.id,
      },
    })
    productCount++
    console.log(`  ✅ Product: "${product.name}" (SKU: ${p.sku})`)

    // Ensure the product image exists (idempotent)
    const existingImage = await prisma.productImage.findFirst({
      where: { productId: product.id, url: p.imageUrl },
    })
    if (!existingImage) {
      const imageCountForProduct = await prisma.productImage.count({
        where: { productId: product.id },
      })
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: p.imageUrl,
          alt: p.imageAlt,
          sortOrder: imageCountForProduct,
        },
      })
      imageCount++
    }

    // Upsert inventory (idempotent)
    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: {
        quantity: p.quantity,
        lowStockThreshold: p.lowStockThreshold,
      },
      create: {
        productId: product.id,
        quantity: p.quantity,
        lowStockThreshold: p.lowStockThreshold,
      },
    })
    inventoryCount++
  }

  // ── Summary ────────────────────────────────
  const elapsed = Date.now() - startedAt
  console.log("\n📊 Seed summary:")
  console.log(`  Stores:          1`)
  console.log(`  Categories:      ${categoryCount}`)
  console.log(`  Products:        ${productCount}`)
  console.log(`  Images created:  ${imageCount}`)
  console.log(`  Inventory:       ${inventoryCount}`)
  console.log(`  Time:            ${elapsed}ms`)
  console.log("\n✨ Seed complete. The seed is idempotent — safe to run again.")
}

main()
  .catch((error) => {
    console.error("\n❌ Seed failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })