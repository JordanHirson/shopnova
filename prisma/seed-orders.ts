/**
 * ShopNova — Seed demo orders for the AI Insights demo (Demo Step 6).
 *
 * The main seed (prisma/seed.ts) creates the store, categories, products,
 * and inventory — but NO customers and NO orders. This script fills that gap
 * so the dashboard's "Recent orders" table, the AI insights growth %, and
 * the Active Carts & Recovery feed all have realistic data to show.
 *
 * It creates:
 *   - 6 customers (also used by the abandonment feed)
 *   - ~40 orders spread across THIS month and LAST month, weighted so
 *     Electronics leads growth (~+42%), followed by Fashion — exactly the
 *     story the AI insights demo tells.
 *
 * Idempotent: safe to run multiple times. It does NOT delete existing
 * orders/customers; it only creates what's missing. Re-running after a
 * month boundary simply adds more orders to the new "this month".
 *
 * Usage:  npm run db:seed-orders
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// ── Environment (mirrors prisma/seed.ts) ──────────────────────
try {
  process.loadEnvFile(".env.local")
} catch {
  try {
    process.loadEnvFile(".env")
  } catch {
    console.warn("No .env.local or .env found. Using DATABASE_URL from environment.")
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to your .env.local file.")
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// ── Demo customers ───────────────────────────────────────────
// First names pair with the same last names in the abandonment feed
// (lib/db/abandonment.ts orders customers by createdAt asc), so the
// recovery feed shows friendly names like "John Doe".
interface CustomerSeed {
  email: string
  firstName: string
  lastName: string
  phone: string
}

const CUSTOMERS: CustomerSeed[] = [
  { email: "john.doe@example.com", firstName: "John", lastName: "Doe", phone: "+27 82 123 4567" },
  { email: "sarah.ndlovu@example.com", firstName: "Sarah", lastName: "Ndlovu", phone: "+27 83 234 5678" },
  { email: "thabo.molefe@example.com", firstName: "Thabo", lastName: "Molefe", phone: "+27 84 345 6789" },
  { email: "amara.okafor@example.com", firstName: "Amara", lastName: "Okafor", phone: "+27 85 456 7890" },
  { email: "liam.williams@example.com", firstName: "Liam", lastName: "Williams", phone: "+27 86 567 8901" },
  { email: "zara.khan@example.com", firstName: "Zara", lastName: "Khan", phone: "+27 87 678 9012" },
]

// ── Order plan ───────────────────────────────────────────────
// Each entry = one order. `monthsAgo` places it in the current month (0)
// or the previous calendar month (1). `categorySlug` picks the product
// the order item references, so revenue aggregates by category exactly
// as the /api/ai/insights route computes it.
//
// Weighting (per category, this month vs last month):
//   Electronics: 12 this month vs  8 last month  → ~+50% growth (leader)
//   Fashion:      8 this month vs  6 last month  → ~+33% (runner-up)
//   Home & Living: 5 this month vs 5 last month  →  0%
//   Beauty:       3 this month vs 4 last month  → -25%
//   Sports:       2 this month vs 2 last month  →  0%
//
// This gives Electronics a clear lead with a ~+42-50% growth story.
interface OrderPlan {
  customerIndex: number
  categorySlug: string
  productSlug: string
  quantity: number
  monthsAgo: number
  status: "DELIVERED" | "SHIPPED" | "PROCESSING" | "CONFIRMED" | "PENDING"
}

const ORDERS: OrderPlan[] = [
  // ── Electronics — THIS month (12) ──
  { customerIndex: 0, categorySlug: "electronics", productSlug: "wireless-noise-cancelling-headphones", quantity: 1, monthsAgo: 0, status: "DELIVERED" },
  { customerIndex: 1, categorySlug: "electronics", productSlug: "smart-fitness-watch", quantity: 2, monthsAgo: 0, status: "DELIVERED" },
  { customerIndex: 2, categorySlug: "electronics", productSlug: "4k-mirrorless-digital-camera", quantity: 1, monthsAgo: 0, status: "SHIPPED" },
  { customerIndex: 3, categorySlug: "electronics", productSlug: "portable-bluetooth-speaker", quantity: 3, monthsAgo: 0, status: "DELIVERED" },
  { customerIndex: 4, categorySlug: "electronics", productSlug: "wireless-noise-cancelling-headphones", quantity: 1, monthsAgo: 0, status: "PROCESSING" },
  { customerIndex: 5, categorySlug: "electronics", productSlug: "smart-fitness-watch", quantity: 1, monthsAgo: 0, status: "DELIVERED" },
  { customerIndex: 0, categorySlug: "electronics", productSlug: "portable-bluetooth-speaker", quantity: 2, monthsAgo: 0, status: "DELIVERED" },
  { customerIndex: 1, categorySlug: "electronics", productSlug: "wireless-noise-cancelling-headphones", quantity: 1, monthsAgo: 0, status: "SHIPPED" },
  { customerIndex: 2, categorySlug: "electronics", productSlug: "smart-fitness-watch", quantity: 1, monthsAgo: 0, status: "CONFIRMED" },
  { customerIndex: 3, categorySlug: "electronics", productSlug: "4k-mirrorless-digital-camera", quantity: 1, monthsAgo: 0, status: "DELIVERED" },
  { customerIndex: 4, categorySlug: "electronics", productSlug: "portable-bluetooth-speaker", quantity: 1, monthsAgo: 0, status: "DELIVERED" },
  { customerIndex: 5, categorySlug: "electronics", productSlug: "wireless-noise-cancelling-headphones", quantity: 2, monthsAgo: 0, status: "PROCESSING" },

  // ── Electronics — LAST month (8) ──
  { customerIndex: 0, categorySlug: "electronics", productSlug: "wireless-noise-cancelling-headphones", quantity: 1, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 1, categorySlug: "electronics", productSlug: "smart-fitness-watch", quantity: 1, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 2, categorySlug: "electronics", productSlug: "portable-bluetooth-speaker", quantity: 2, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 3, categorySlug: "electronics", productSlug: "wireless-noise-cancelling-headphones", quantity: 1, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 4, categorySlug: "electronics", productSlug: "smart-fitness-watch", quantity: 1, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 5, categorySlug: "electronics", productSlug: "portable-bluetooth-speaker", quantity: 1, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 0, categorySlug: "electronics", productSlug: "4k-mirrorless-digital-camera", quantity: 1, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 2, categorySlug: "electronics", productSlug: "wireless-noise-cancelling-headphones", quantity: 1, monthsAgo: 1, status: "DELIVERED" },

  // ── Fashion — THIS month (8) ──
  { customerIndex: 0, categorySlug: "fashion", productSlug: "classic-running-sneakers", quantity: 1, monthsAgo: 0, status: "DELIVERED" },
  { customerIndex: 1, categorySlug: "fashion", productSlug: "everyday-canvas-backpack", quantity: 1, monthsAgo: 0, status: "SHIPPED" },
  { customerIndex: 2, categorySlug: "fashion", productSlug: "polarized-aviator-sunglasses", quantity: 2, monthsAgo: 0, status: "DELIVERED" },
  { customerIndex: 3, categorySlug: "fashion", productSlug: "classic-running-sneakers", quantity: 1, monthsAgo: 0, status: "DELIVERED" },
  { customerIndex: 4, categorySlug: "fashion", productSlug: "everyday-canvas-backpack", quantity: 1, monthsAgo: 0, status: "PROCESSING" },
  { customerIndex: 5, categorySlug: "fashion", productSlug: "polarized-aviator-sunglasses", quantity: 1, monthsAgo: 0, status: "DELIVERED" },
  { customerIndex: 0, categorySlug: "fashion", productSlug: "classic-running-sneakers", quantity: 2, monthsAgo: 0, status: "CONFIRMED" },
  { customerIndex: 2, categorySlug: "fashion", productSlug: "everyday-canvas-backpack", quantity: 1, monthsAgo: 0, status: "DELIVERED" },

  // ── Fashion — LAST month (6) ──
  { customerIndex: 1, categorySlug: "fashion", productSlug: "classic-running-sneakers", quantity: 1, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 3, categorySlug: "fashion", productSlug: "polarized-aviator-sunglasses", quantity: 1, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 4, categorySlug: "fashion", productSlug: "classic-running-sneakers", quantity: 1, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 5, categorySlug: "fashion", productSlug: "everyday-canvas-backpack", quantity: 1, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 0, categorySlug: "fashion", productSlug: "polarized-aviator-sunglasses", quantity: 2, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 2, categorySlug: "fashion", productSlug: "classic-running-sneakers", quantity: 1, monthsAgo: 1, status: "DELIVERED" },

  // ── Home & Living — THIS month (5) ──
  { customerIndex: 1, categorySlug: "home-living", productSlug: "modern-lounge-chair", quantity: 1, monthsAgo: 0, status: "DELIVERED" },
  { customerIndex: 3, categorySlug: "home-living", productSlug: "ceramic-table-lamp", quantity: 2, monthsAgo: 0, status: "SHIPPED" },
  { customerIndex: 5, categorySlug: "home-living", productSlug: "stoneware-coffee-mug", quantity: 4, monthsAgo: 0, status: "DELIVERED" },
  { customerIndex: 0, categorySlug: "home-living", productSlug: "decorative-glass-vase", quantity: 1, monthsAgo: 0, status: "DELIVERED" },
  { customerIndex: 2, categorySlug: "home-living", productSlug: "ceramic-table-lamp", quantity: 1, monthsAgo: 0, status: "PROCESSING" },

  // ── Home & Living — LAST month (5) ──
  { customerIndex: 1, categorySlug: "home-living", productSlug: "modern-lounge-chair", quantity: 1, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 3, categorySlug: "home-living", productSlug: "ceramic-table-lamp", quantity: 2, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 5, categorySlug: "home-living", productSlug: "stoneware-coffee-mug", quantity: 4, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 0, categorySlug: "home-living", productSlug: "decorative-glass-vase", quantity: 1, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 2, categorySlug: "home-living", productSlug: "ceramic-table-lamp", quantity: 1, monthsAgo: 1, status: "DELIVERED" },

  // ── Beauty — THIS month (3) ──
  { customerIndex: 4, categorySlug: "beauty", productSlug: "hydrating-face-serum", quantity: 2, monthsAgo: 0, status: "DELIVERED" },
  { customerIndex: 5, categorySlug: "beauty", productSlug: "signature-eau-de-parfum", quantity: 1, monthsAgo: 0, status: "SHIPPED" },
  { customerIndex: 1, categorySlug: "beauty", productSlug: "hydrating-face-serum", quantity: 1, monthsAgo: 0, status: "DELIVERED" },

  // ── Beauty — LAST month (4) ──
  { customerIndex: 4, categorySlug: "beauty", productSlug: "hydrating-face-serum", quantity: 2, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 5, categorySlug: "beauty", productSlug: "signature-eau-de-parfum", quantity: 1, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 1, categorySlug: "beauty", productSlug: "hydrating-face-serum", quantity: 1, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 3, categorySlug: "beauty", productSlug: "signature-eau-de-parfum", quantity: 1, monthsAgo: 1, status: "DELIVERED" },

  // ── Sports & Outdoors — THIS month (2) ──
  { customerIndex: 2, categorySlug: "sports-outdoors", productSlug: "insulated-stainless-bottle", quantity: 2, monthsAgo: 0, status: "DELIVERED" },
  { customerIndex: 4, categorySlug: "sports-outdoors", productSlug: "non-slip-yoga-mat", quantity: 1, monthsAgo: 0, status: "SHIPPED" },

  // ── Sports & Outdoors — LAST month (2) ──
  { customerIndex: 2, categorySlug: "sports-outdoors", productSlug: "insulated-stainless-bottle", quantity: 2, monthsAgo: 1, status: "DELIVERED" },
  { customerIndex: 4, categorySlug: "sports-outdoors", productSlug: "non-slip-yoga-mat", quantity: 1, monthsAgo: 1, status: "DELIVERED" },
]

const SHIPPING = {
  address: "12 Main Road",
  city: "Cape Town",
  province: "Western Cape",
  postalCode: "8000",
  country: "South Africa",
}

const VAT_RATE = 0.15

/** Date placed `monthsAgo` calendar months back, mid-month so it never lands on a month boundary. */
function dateMonthsAgo(monthsAgo: number): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo, 15, 10, 30, 0, 0)
}

/** SN-YYYYMMDD-XXXXXX — mirrors features/checkout/checkout-logic.ts. */
function makeOrderNumber(date: Date, salt: number): string {
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "")
  const suffix = (900000 + salt).toString().padStart(6, "0")
  return `SN-${yyyymmdd}-${suffix}`
}

async function main() {
  const startedAt = Date.now()
  console.log("🌱 Seeding ShopNova demo orders…\n")

  const store = await prisma.store.findFirst({ orderBy: { createdAt: "asc" } })
  if (!store) {
    console.error("❌ No store found. Run `npm run db:seed` first to create the store, categories, and products.")
    process.exit(1)
  }

  // ── Customers (idempotent upsert by [storeId, email]) ──
  const customerIds: string[] = []
  let customerCount = 0
  for (const c of CUSTOMERS) {
    const customer = await prisma.customer.upsert({
      where: { storeId_email: { storeId: store.id, email: c.email } },
      update: { firstName: c.firstName, lastName: c.lastName, phone: c.phone },
      create: {
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        storeId: store.id,
      },
    })
    customerIds.push(customer.id)
    customerCount++
  }
  console.log(`✅ Customers: ${customerCount}`)

  // ── Products lookup by slug ──
  const products = await prisma.product.findMany({
    where: { storeId: store.id },
    select: { id: true, slug: true, price: true },
  })
  const productBySlug = new Map(products.map((p) => [p.slug, p]))
  if (productBySlug.size === 0) {
    console.error("❌ No products found. Run `npm run db:seed` first.")
    process.exit(1)
  }

  // ── Orders (idempotent: skip if orderNumber exists) ──
  let orderCount = 0
  let orderItemCount = 0
  let skipped = 0

  for (let i = 0; i < ORDERS.length; i++) {
    const plan = ORDERS[i]
    const product = productBySlug.get(plan.productSlug)
    if (!product) {
      console.warn(`  ⚠️ Skipping — product "${plan.productSlug}" not found`)
      continue
    }

    const date = dateMonthsAgo(plan.monthsAgo)
    const orderNumber = makeOrderNumber(date, i)

    // Idempotent: skip if this order already exists.
    const existing = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true },
    })
    if (existing) {
      skipped++
      continue
    }

    const customerId = customerIds[plan.customerIndex % customerIds.length]
    const unitPrice = Number(product.price)
    const subtotal = unitPrice * plan.quantity
    const tax = Math.round(subtotal * VAT_RATE * 100) / 100
    const shipping = 50
    const total = Math.round((subtotal + tax + shipping) * 100) / 100

    const customer = CUSTOMERS[plan.customerIndex % CUSTOMERS.length]

    const order = await prisma.order.create({
      data: {
        orderNumber,
        status: plan.status,
        subtotal,
        tax,
        shipping,
        total,
        shippingFirstName: customer.firstName,
        shippingLastName: customer.lastName,
        shippingEmail: customer.email,
        shippingPhone: customer.phone,
        shippingAddress: SHIPPING.address,
        shippingCity: SHIPPING.city,
        shippingProvince: SHIPPING.province,
        shippingPostalCode: SHIPPING.postalCode,
        shippingCountry: SHIPPING.country,
        shippingProvider: "mvp",
        shippingMethod: "Standard shipping",
        currency: "ZAR",
        storeId: store.id,
        customerId,
        items: {
          create: [
            {
              productId: product.id,
              quantity: plan.quantity,
              unitPrice,
              totalPrice: subtotal,
            },
          ],
        },
      },
    })
    orderCount++
    orderItemCount++
  }

  // ── Summary ──
  const elapsed = Date.now() - startedAt
  console.log(`✅ Orders created: ${orderCount} (${orderItemCount} items)`)
  if (skipped > 0) console.log(`   Skipped (already existed): ${skipped}`)
  console.log(`   Time: ${elapsed}ms`)
  console.log("\n✨ Seed-orders complete. Idempotent — safe to run again.")
  console.log("   Re-run after a month boundary to refresh 'this month' data.")
}

main()
  .catch((error) => {
    console.error("\n❌ Seed-orders failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
