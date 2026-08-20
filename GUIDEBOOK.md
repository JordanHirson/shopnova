# Guidebook 2 — ShopNova

> **AI-Native E-Commerce Operating System**
>
> A comprehensive build guide for a Shopify-grade e-commerce platform with multi-store federation, third-party catalog aggregation via API, AI merchandising, and end-to-end automation.

---

## Table of Contents

1. [Project Vision & Business Case](#1-project-vision--business-case)
2. [Learning Outcomes](#2-learning-outcomes)
3. [Tech Stack & Tooling](#3-tech-stack--tooling)
4. [System Architecture](#4-system-architecture)
5. [Data Model — Full Prisma Schema](#5-data-model--full-prisma-schema)
6. [Storefront Architecture](#6-storefront-architecture)
7. [Admin Dashboard Architecture](#7-admin-dashboard-architecture)
8. [Catalog Federation (Linking External Stores)](#8-catalog-federation-linking-external-stores)
9. [AI Merchandising & Personalization](#9-ai-merchandising--personalization)
10. [Cart, Checkout & Payments](#10-cart-checkout--payments)
11. [Order Lifecycle & Fulfillment](#11-order-lifecycle--fulfillment)
12. [Inventory Management](#12-inventory-management)
13. [Marketing & Customer Engagement](#13-marketing--customer-engagement)
14. [Analytics & Reporting](#14-analytics--reporting)
15. [Webhook & Event Architecture](#15-webhook--event-architecture)
16. [Testing & Evals](#16-testing--evals)
17. [DevOps & Deployment](#17-devops--deployment)
18. [Compliance (PCI-DSS Lite, POPIA, GDPR)](#18-compliance-pci-dss-lite-popia-gdpr)
19. [12-Sprint Development Roadmap](#19-12-sprint-development-roadmap)
20. [Acceptance Criteria & Demo Script](#20-acceptance-criteria--demo-script)
21. [Stretch Goals](#21-stretch-goals)
22. [Resources](#22-resources)

---

## 1. Project Vision & Business Case

### The Problem

Shopify dominates e-commerce SaaS but has structural weaknesses:
- Pricing escalates aggressively as merchants grow.
- Apps marketplace fragments the experience; merchants pay 5–15 separate subscriptions.
- AI features are still bolted on (Shopify Magic), not woven into the product.
- Linking inventory across multiple stores or aggregating from external suppliers requires complex apps.

WooCommerce, BigCommerce, Magento — all suffer from the same legacy architecture.

### The Opportunity

Build an **AI-native e-commerce platform** with:
- **Catalog federation**: A merchant can plug in another store's API (Shopify, Takealot, Amazon, AliExpress) and resell their products with auto-synced inventory and pricing.
- **AI merchandising**: Auto-generated product copy, photo enhancement, smart search, personalized recommendations — built in, not paid extras.
- **Operations agents**: Order triage, refund disputes, customer support, inventory replenishment — handled autonomously.
- **Multi-currency / multi-region** out of the box, optimized for emerging markets.

### Business Model

- **Tier 1 — Starter**: R29/month + 2.4% transaction fee, up to 100 SKUs.
- **Tier 2 — Growth**: R99/month + 1.9% fee, unlimited SKUs.
- **Tier 3 — Plus**: R499/month + 1.4% fee, multi-store, federation, B2B.
- **AI usage**: 5,000 AI runs/month included; R0.05 per additional run.
- **Marketplace**: 20% revenue share on third-party plugins.

### Competitive Position

| Competitor | Where ShopNova Wins |
|------------|---------------------|
| Shopify | Lower fees, federation built in, AI-first |
| WooCommerce | Fully managed, no plugin chaos |
| BigCommerce | Modern stack, better DX |
| Magento | 100x simpler, no PHP nightmare |
| Wix | Real e-commerce primitives, multi-store |

---

## 2. Learning Outcomes

**Engineering**
- Headless commerce architecture (storefront + admin + API)
- Multi-tenant SaaS at scale
- Webhook-driven integration (Stripe, PayFast, Yoco, courier APIs)
- Background processing for inventory sync, order fulfillment
- Real-time analytics with materialized views and ClickHouse
- ISR (Incremental Static Regeneration) for product pages

**AI**
- Vector search for product discovery
- Multi-modal embeddings (text + image)
- Generative product descriptions
- Recommendation systems (collaborative + content-based)
- Conversational shopping agents
- Image enhancement / background removal pipelines

**Commerce Domain**
- Inventory accounting (FIFO, LIFO, weighted average)
- Multi-currency tax computation
- Order state machines and reverse logistics
- Subscription billing
- B2B price lists and quote workflows

---

## 3. Tech Stack & Tooling

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 LTS |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.6+ |
| UI | React 19 + Tailwind 4 + shadcn/ui |
| ORM | Prisma 6 |
| DB (transactional) | PostgreSQL 16 + pgvector |
| DB (analytics) | ClickHouse Cloud |
| Cache | Redis (Upstash) |
| Search | Meilisearch or Typesense |
| Vector | pgvector |
| Queue | Inngest |
| Storage | Cloudflare R2 |
| CDN / Image | Cloudflare Images |
| Auth | Clerk + JWT for storefront customers |
| Payments | Stripe + PayFast (SA) + Yoco (SA) + Stitch |
| Couriers | Aramex, The Courier Guy, PUDO, Bob Go (multi-courier API) |
| Email | Resend + Customer.io |
| SMS | Twilio + Clickatell (SA) |
| LLM | Anthropic Claude (text + vision) |
| Embeddings | OpenAI `text-embedding-3-large` |
| Image AI | Replicate (background removal, enhancement) |
| Observability | Langfuse, Sentry, PostHog |

### Repo Structure

```
shopnova/
├── apps/
│   ├── storefront/          # public e-commerce site (Next.js)
│   ├── admin/               # merchant dashboard (Next.js)
│   ├── api/                 # public REST/tRPC API for headless usage
│   └── workers/             # Inngest workers
├── packages/
│   ├── db/
│   ├── ui/
│   ├── ai/
│   ├── commerce-core/       # cart, pricing, tax, discounts (pure)
│   ├── integrations/        # Shopify import, courier APIs, payments
│   ├── search/              # Meilisearch client + indexers
│   └── webhooks/
├── docker-compose.yml
└── turbo.json
```

---

## 4. System Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                         CUSTOMERS                                  │
│  Web storefront · Mobile · Voice · Social commerce embeds          │
└──────────┬───────────────────────────────────────┬────────────────┘
           │                                       │
┌──────────▼─────────────┐               ┌─────────▼─────────────┐
│    STOREFRONT (RSC)    │               │      ADMIN APP         │
│  ISR product pages     │               │  Merchant dashboard    │
│  Edge-cached cart      │               │  AI Studio             │
└──────────┬─────────────┘               └─────────┬─────────────┘
           │                                       │
           └───────────────┬───────────────────────┘
                           │
┌──────────────────────────▼────────────────────────────────────────┐
│                    UNIFIED COMMERCE API                            │
│           tRPC + REST + Webhooks · Edge functions                  │
└──┬──────────┬──────────┬─────────────┬────────────┬───────────────┘
   │          │          │             │            │
┌──▼─────┐ ┌──▼─────┐ ┌──▼──────┐ ┌────▼──────┐ ┌───▼──────┐
│Postgres│ │Search  │ │ClickHouse│ │ AI Agents │ │Inngest   │
│+pgvector│ │Meili  │ │Analytics │ │ + Tools   │ │Workers   │
└─────────┘ └────────┘ └──────────┘ └────┬──────┘ └──────────┘
                                         │
              ┌──────────────────────────┼─────────────────────┐
              │                          │                     │
        ┌─────▼─────┐            ┌───────▼──────┐      ┌───────▼──────┐
        │ Stripe    │            │ Federation   │      │ Couriers     │
        │ PayFast   │            │ Importers    │      │ Aramex etc.  │
        │ Yoco      │            │ Shopify/Amz  │      │              │
        └───────────┘            └──────────────┘      └──────────────┘
```

### Key Decisions

- **Storefront and admin are separate Next.js apps**, sharing UI + types via packages.
- **Storefront uses ISR** (revalidate on demand) for product pages — fast and SEO-friendly.
- **Cart lives in Redis** for sub-50ms reads at any scale.
- **Search is Meilisearch** for typo-tolerant, multilingual product discovery.
- **Analytics uses ClickHouse** for sub-second queries over millions of events.

---

## 5. Data Model — Full Prisma Schema

```prisma
// schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions", "fullTextSearch"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector"), pg_trgm, citext]
}

// ============================================================
//  TENANCY: Stores
// ============================================================

model Store {
  id              String   @id @default(cuid())
  slug            String   @unique
  name            String
  domain          String?  @unique
  primaryCurrency String   @default("ZAR")
  primaryLocale   String   @default("en-ZA")
  countryCode     String   @default("ZA")
  timezone        String   @default("Africa/Johannesburg")
  brandColors     Json?    // { primary, secondary, accent }
  logoUrl         String?
  faviconUrl      String?
  plan            Plan     @default(STARTER)
  status          StoreStatus @default(ACTIVE)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  staff           Staff[]
  products        Product[]
  orders          Order[]
  customers       Customer[]
  collections     Collection[]
  discounts       Discount[]
  channels        Channel[]
  federations     FederationLink[]
  webhooks        WebhookEndpoint[]

  @@index([slug])
}

enum Plan { STARTER GROWTH PLUS ENTERPRISE }
enum StoreStatus { ACTIVE PAUSED FROZEN }

model Staff {
  id        String   @id @default(cuid())
  storeId   String
  email     String
  fullName  String
  role      StaffRole
  clerkId   String   @unique
  store     Store    @relation(fields: [storeId], references: [id])
  createdAt DateTime @default(now())

  @@unique([storeId, email])
}

enum StaffRole { OWNER ADMIN MANAGER STAFF }

// ============================================================
//  CATALOG
// ============================================================

model Product {
  id              String   @id @default(cuid())
  storeId         String
  title           String
  handle          String   // url-friendly slug
  description     String   @db.Text
  vendor          String?
  productType     String?
  status          ProductStatus @default(DRAFT)
  tags            String[]
  isFederated     Boolean  @default(false)
  federationLinkId String?
  externalId      String?  // SKU on the upstream marketplace
  embedding       Unsupported("vector(1536)")?  // text+image avg
  textEmbedding   Unsupported("vector(1536)")?
  imageEmbedding  Unsupported("vector(1536)")?
  seoTitle        String?
  seoDescription  String?
  publishedAt     DateTime?

  store           Store    @relation(fields: [storeId], references: [id])
  variants        Variant[]
  images          ProductImage[]
  collections     CollectionProduct[]
  reviews         Review[]
  federation      FederationLink? @relation(fields: [federationLinkId], references: [id])

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([storeId, handle])
  @@index([storeId, status])
  @@index([storeId, productType])
}

enum ProductStatus { DRAFT ACTIVE ARCHIVED }

model Variant {
  id              String   @id @default(cuid())
  productId       String
  sku             String
  title           String   // "Red / Large"
  optionValues    Json     // { color: "red", size: "L" }
  price           Decimal  @db.Decimal(12, 2)
  compareAtPrice  Decimal? @db.Decimal(12, 2)
  cost            Decimal? @db.Decimal(12, 2)
  weight          Float?   // grams
  weightUnit      String   @default("g")
  barcode         String?
  inventoryItemId String?
  taxable         Boolean  @default(true)
  requiresShipping Boolean @default(true)

  product         Product  @relation(fields: [productId], references: [id])
  inventoryItem   InventoryItem? @relation(fields: [inventoryItemId], references: [id])

  createdAt       DateTime @default(now())

  @@unique([productId, sku])
  @@index([sku])
}

model ProductImage {
  id          String   @id @default(cuid())
  productId   String
  url         String
  altText     String?
  position    Int      @default(0)
  width       Int?
  height      Int?

  product     Product  @relation(fields: [productId], references: [id])

  @@index([productId])
}

model Collection {
  id          String   @id @default(cuid())
  storeId     String
  title       String
  handle      String
  description String?  @db.Text
  imageUrl    String?
  isAutomatic Boolean  @default(false)
  rules       Json?    // smart collection rules

  store       Store    @relation(fields: [storeId], references: [id])
  products    CollectionProduct[]

  createdAt   DateTime @default(now())

  @@unique([storeId, handle])
}

model CollectionProduct {
  collectionId String
  productId    String
  position     Int      @default(0)

  collection   Collection @relation(fields: [collectionId], references: [id])
  product      Product    @relation(fields: [productId], references: [id])

  @@id([collectionId, productId])
}

// ============================================================
//  INVENTORY (multi-location)
// ============================================================

model Location {
  id          String   @id @default(cuid())
  storeId     String
  name        String
  address     Json
  isActive    Boolean  @default(true)

  inventoryLevels InventoryLevel[]
  fulfillments    Fulfillment[]
}

model InventoryItem {
  id              String   @id @default(cuid())
  sku             String
  trackQuantity   Boolean  @default(true)
  reserveStrategy String   @default("FIFO")  // FIFO | LIFO

  variants        Variant[]
  levels          InventoryLevel[]
  movements       InventoryMovement[]
}

model InventoryLevel {
  id              String   @id @default(cuid())
  inventoryItemId String
  locationId      String
  available       Int      @default(0)
  committed       Int      @default(0)
  onHand          Int      @default(0)

  inventoryItem   InventoryItem @relation(fields: [inventoryItemId], references: [id])
  location        Location      @relation(fields: [locationId], references: [id])

  @@unique([inventoryItemId, locationId])
}

model InventoryMovement {
  id              String   @id @default(cuid())
  inventoryItemId String
  locationId      String
  type            MovementType
  quantity        Int
  reference       String?  // order id, transfer id, adjustment reason
  cost            Decimal? @db.Decimal(12, 2)
  createdAt       DateTime @default(now())

  inventoryItem   InventoryItem @relation(fields: [inventoryItemId], references: [id])

  @@index([inventoryItemId, createdAt])
}

enum MovementType { RECEIVE SHIP RETURN ADJUSTMENT TRANSFER }

// ============================================================
//  CUSTOMERS & ACCOUNTS
// ============================================================

model Customer {
  id              String   @id @default(cuid())
  storeId         String
  email           String
  firstName       String?
  lastName        String?
  phone           String?
  acceptsMarketing Boolean @default(false)
  totalSpent      Decimal  @default(0) @db.Decimal(12, 2)
  ordersCount     Int      @default(0)
  vipScore        Float?   // computed
  churnScore      Float?   // computed
  preferences     Json?    // size, brands, etc.

  store           Store    @relation(fields: [storeId], references: [id])
  addresses       Address[]
  orders          Order[]
  reviews         Review[]
  cartId          String?
  cart            Cart?    @relation(fields: [cartId], references: [id])
  segments        CustomerSegmentMember[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([storeId, email])
  @@index([storeId])
}

model Address {
  id          String   @id @default(cuid())
  customerId  String
  firstName   String?
  lastName    String?
  company     String?
  street1     String
  street2     String?
  city        String
  province    String?
  postalCode  String
  country     String
  phone       String?
  isDefault   Boolean  @default(false)

  customer    Customer @relation(fields: [customerId], references: [id])
}

model CustomerSegment {
  id          String   @id @default(cuid())
  storeId     String
  name        String
  rules       Json     // criteria
  members     CustomerSegmentMember[]
  createdAt   DateTime @default(now())
}

model CustomerSegmentMember {
  customerId  String
  segmentId   String
  customer    Customer @relation(fields: [customerId], references: [id])
  segment     CustomerSegment @relation(fields: [segmentId], references: [id])
  @@id([customerId, segmentId])
}

// ============================================================
//  CART & CHECKOUT
// ============================================================

model Cart {
  id          String     @id @default(cuid())
  storeId     String
  customerId  String?
  channelId   String?
  currency    String
  subtotal    Decimal    @default(0) @db.Decimal(12, 2)
  total       Decimal    @default(0) @db.Decimal(12, 2)
  discounts   Json[]     // applied discount snapshots
  metadata    Json?
  expiresAt   DateTime
  abandonedAt DateTime?

  items       CartItem[]
  customers   Customer[]

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([storeId])
}

model CartItem {
  id          String   @id @default(cuid())
  cartId      String
  variantId   String
  quantity    Int
  unitPrice   Decimal  @db.Decimal(12, 2)
  metadata    Json?    // gift wrap, customizations

  cart        Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)

  @@index([cartId])
}

// ============================================================
//  ORDERS, FULFILLMENT, RETURNS
// ============================================================

model Order {
  id              String   @id @default(cuid())
  storeId         String
  customerId      String?
  number          Int      // human-friendly per-store sequential
  email           String
  phone           String?
  currency        String
  subtotal        Decimal  @db.Decimal(12, 2)
  shippingTotal   Decimal  @db.Decimal(12, 2) @default(0)
  taxTotal        Decimal  @db.Decimal(12, 2) @default(0)
  discountTotal   Decimal  @db.Decimal(12, 2) @default(0)
  grandTotal      Decimal  @db.Decimal(12, 2)
  financialStatus FinancialStatus @default(PENDING)
  fulfillmentStatus FulfillmentStatus @default(UNFULFILLED)
  shippingAddress Json
  billingAddress  Json
  channel         String?  // 'web' | 'pos' | 'instagram' | 'whatsapp'
  riskScore       Float?
  riskFactors     Json?
  notes           String?  @db.Text
  cancelReason    String?
  cancelledAt     DateTime?

  store           Store    @relation(fields: [storeId], references: [id])
  customer        Customer? @relation(fields: [customerId], references: [id])
  items           OrderItem[]
  payments        Payment[]
  fulfillments    Fulfillment[]
  returns         Return[]
  events          OrderEvent[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([storeId, number])
  @@index([storeId, createdAt])
  @@index([financialStatus])
}

enum FinancialStatus {
  PENDING AUTHORIZED PAID PARTIALLY_PAID
  REFUNDED PARTIALLY_REFUNDED VOIDED
}

enum FulfillmentStatus {
  UNFULFILLED PARTIALLY_FULFILLED FULFILLED
  RESTOCKED CANCELLED
}

model OrderItem {
  id              String   @id @default(cuid())
  orderId         String
  variantId       String
  productSnapshot Json     // title, image, etc. at time of purchase
  quantity        Int
  unitPrice       Decimal  @db.Decimal(12, 2)
  discountTotal   Decimal  @db.Decimal(12, 2) @default(0)
  taxTotal        Decimal  @db.Decimal(12, 2) @default(0)
  totalPrice      Decimal  @db.Decimal(12, 2)
  fulfillmentStatus FulfillmentStatus @default(UNFULFILLED)

  order           Order    @relation(fields: [orderId], references: [id])

  @@index([orderId])
}

model Payment {
  id              String   @id @default(cuid())
  orderId         String
  amount          Decimal  @db.Decimal(12, 2)
  currency        String
  gateway         String   // 'stripe' | 'payfast' | 'yoco' | 'eft'
  gatewayId       String   // external charge id
  status          PaymentStatus @default(PENDING)
  errorCode       String?
  cardBrand       String?
  cardLast4       String?

  order           Order    @relation(fields: [orderId], references: [id])

  createdAt       DateTime @default(now())
}

enum PaymentStatus { PENDING SUCCEEDED FAILED REFUNDED PARTIALLY_REFUNDED }

model Fulfillment {
  id              String   @id @default(cuid())
  orderId         String
  locationId      String
  carrier         String?
  trackingNumber  String?
  trackingUrl     String?
  status          FulfillmentStatus @default(UNFULFILLED)
  shippedAt       DateTime?
  deliveredAt     DateTime?

  order           Order    @relation(fields: [orderId], references: [id])
  location        Location @relation(fields: [locationId], references: [id])
  items           FulfillmentItem[]
}

model FulfillmentItem {
  id              String   @id @default(cuid())
  fulfillmentId   String
  orderItemId     String
  quantity        Int

  fulfillment     Fulfillment @relation(fields: [fulfillmentId], references: [id])
}

model Return {
  id              String   @id @default(cuid())
  orderId         String
  reason          String
  status          String   @default("REQUESTED")  // REQUESTED, APPROVED, RECEIVED, REFUNDED
  refundAmount    Decimal? @db.Decimal(12, 2)
  notes           String?  @db.Text
  aiAssessment    Json?    // AI's recommendation

  order           Order    @relation(fields: [orderId], references: [id])
  createdAt       DateTime @default(now())
}

model OrderEvent {
  id          String   @id @default(cuid())
  orderId     String
  type        String
  actor       String
  payload     Json
  createdAt   DateTime @default(now())

  order       Order    @relation(fields: [orderId], references: [id])

  @@index([orderId])
}

// ============================================================
//  DISCOUNTS, GIFT CARDS, REVIEWS
// ============================================================

model Discount {
  id              String   @id @default(cuid())
  storeId         String
  code            String?
  title           String
  type            DiscountType
  value           Decimal  @db.Decimal(12, 4)
  appliesTo       String   // ALL, COLLECTIONS, PRODUCTS
  appliesIds      String[]
  minimumSpend    Decimal? @db.Decimal(12, 2)
  oncePerCustomer Boolean  @default(false)
  startsAt        DateTime
  endsAt          DateTime?
  usageLimit      Int?
  usageCount      Int      @default(0)

  store           Store    @relation(fields: [storeId], references: [id])

  @@unique([storeId, code])
}

enum DiscountType { PERCENTAGE FIXED_AMOUNT FREE_SHIPPING BXGY }

model Review {
  id          String   @id @default(cuid())
  productId   String
  customerId  String?
  rating      Int      // 1-5
  title       String?
  body        String   @db.Text
  imageUrls   String[]
  approved    Boolean  @default(false)
  aiSummary   String?  // sentiment, themes
  createdAt   DateTime @default(now())

  product     Product  @relation(fields: [productId], references: [id])
  customer    Customer? @relation(fields: [customerId], references: [id])

  @@index([productId])
}

// ============================================================
//  FEDERATION (linking external stores)
// ============================================================

model FederationLink {
  id              String   @id @default(cuid())
  storeId         String
  source          String   // 'shopify' | 'amazon' | 'takealot' | 'aliexpress' | 'csv'
  name            String   // friendly display
  config          Json     // credentials (encrypted), filters
  syncStrategy    String   @default("MIRROR")  // MIRROR | DROPSHIP | HYBRID
  markupRule      Json?    // { type: 'percentage', value: 25 }
  status          String   @default("ACTIVE")
  lastSyncedAt    DateTime?
  errorMessage    String?  @db.Text

  store           Store    @relation(fields: [storeId], references: [id])
  products        Product[]
  syncRuns        FederationSyncRun[]

  createdAt       DateTime @default(now())
}

model FederationSyncRun {
  id              String   @id @default(cuid())
  federationLinkId String
  status          String   // RUNNING | SUCCESS | FAILED
  productsCreated Int      @default(0)
  productsUpdated Int      @default(0)
  productsRemoved Int      @default(0)
  errors          Json?
  startedAt       DateTime @default(now())
  endedAt         DateTime?

  link            FederationLink @relation(fields: [federationLinkId], references: [id])
}

// ============================================================
//  CHANNELS, WEBHOOKS, AGENTS
// ============================================================

model Channel {
  id          String   @id @default(cuid())
  storeId     String
  type        String   // 'web', 'pos', 'instagram', 'whatsapp', 'tiktok'
  name        String
  config      Json
  isActive    Boolean  @default(true)

  store       Store    @relation(fields: [storeId], references: [id])
}

model WebhookEndpoint {
  id          String   @id @default(cuid())
  storeId     String
  url         String
  topics      String[]
  secret      String
  status      String   @default("ACTIVE")

  store       Store    @relation(fields: [storeId], references: [id])
  deliveries  WebhookDelivery[]
}

model WebhookDelivery {
  id              String   @id @default(cuid())
  endpointId      String
  topic           String
  payload         Json
  responseStatus  Int?
  responseBody    String?  @db.Text
  attempts        Int      @default(0)
  succeeded       Boolean  @default(false)
  createdAt       DateTime @default(now())

  endpoint        WebhookEndpoint @relation(fields: [endpointId], references: [id])
}

model AgentRun {
  id              String   @id @default(cuid())
  storeId         String
  agentName       String
  triggerPayload  Json
  status          String   @default("RUNNING")
  steps           Json[]
  result          Json?
  langfuseTraceId String?
  startedAt       DateTime @default(now())
  endedAt         DateTime?
}
```

---

## 6. Storefront Architecture

The storefront is a separate Next.js 16 app, optimized for **conversions** and **speed**.

### Route Structure

```
apps/storefront/src/app/
  layout.tsx                       # global theme, fonts
  page.tsx                         # home (RSC + ISR)
  products/
    page.tsx                       # all products
    [handle]/page.tsx              # product detail (ISR)
  collections/
    [handle]/page.tsx              # collection (ISR)
  cart/page.tsx                    # cart (client)
  checkout/
    page.tsx                       # checkout shell
    payment/page.tsx
    confirmation/[orderId]/page.tsx
  account/
    page.tsx                       # profile
    orders/page.tsx
    orders/[id]/page.tsx
  search/page.tsx                  # search results
  api/
    webhooks/                      # Stripe etc.
```

### Product Page (ISR)

```tsx
// apps/storefront/src/app/products/[handle]/page.tsx
export const revalidate = 60; // ISR every 60s
export async function generateStaticParams() {
  // Pre-build top 1000 products at build time
  return await getTop1000ProductHandles();
}

export default async function ProductPage({ params }: { params: { handle: string } }) {
  const product = await getProduct(params.handle);
  if (!product) notFound();

  return (
    <>
      <ProductGallery images={product.images} />
      <ProductDetails product={product} />
      <Suspense fallback={<RelatedSkeleton />}>
        <RelatedProducts productId={product.id} /> {/* AI-powered, slower */}
      </Suspense>
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews productId={product.id} />
      </Suspense>
    </>
  );
}
```

### Performance Targets

| Metric | Target |
|--------|--------|
| LCP (Product page) | <1.5s |
| FID | <100ms |
| CLS | <0.1 |
| TTFB | <200ms |
| Bundle size (initial) | <150KB gzipped |

### Cart in Redis

```ts
// packages/commerce-core/src/cart.ts
const CART_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function addToCart(cartId: string, variantId: string, quantity: number) {
  const cart = await redis.json.get<Cart>(`cart:${cartId}`) ?? newCart();
  const existing = cart.items.find(i => i.variantId === variantId);
  if (existing) existing.quantity += quantity;
  else {
    const variant = await db.variant.findUnique({ where: { id: variantId }, include: { product: true }});
    cart.items.push({
      variantId,
      quantity,
      unitPrice: Number(variant!.price),
      title: variant!.product.title,
      image: variant!.product.imageUrls[0],
    });
  }
  await recalculateCart(cart);
  await redis.json.set(`cart:${cartId}`, "$", cart);
  await redis.expire(`cart:${cartId}`, CART_TTL_SECONDS);
  return cart;
}
```

### Storefront Themes

Use shadcn/ui as the base. Provide three themes out of the box:
- **Minimal** (white, generous whitespace, image-led)
- **Bold** (high contrast, large type, dark mode default)
- **Boutique** (serif heading, soft pastels)

Theme switching is a CSS variable swap; no rebuild needed.

---

## 7. Admin Dashboard Architecture

### Pages

```
apps/admin/src/app/
  (dashboard)/
    page.tsx                       # KPI overview
    orders/
      page.tsx                     # filterable list
      [id]/page.tsx                # order detail with timeline
    products/
      page.tsx                     # product list
      new/page.tsx                 # AI-assisted creation
      [id]/page.tsx                # edit
    collections/
    customers/
    inventory/
    discounts/
    analytics/
    apps/                          # extension marketplace
    settings/
      store/
      payments/
      shipping/
      taxes/
      federation/                  # link external stores
    studio/                        # AI playground
```

### KPI Dashboard

```tsx
export default async function DashboardPage() {
  const { storeId } = await auth();
  const [today, yesterday, thisMonth, lastMonth] = await Promise.all([
    getMetrics(storeId, "today"),
    getMetrics(storeId, "yesterday"),
    getMetrics(storeId, "thisMonth"),
    getMetrics(storeId, "lastMonth"),
  ]);

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <KPICard title="Revenue today" value={today.revenue} delta={today.revenue - yesterday.revenue} />
      <KPICard title="Orders today" value={today.orders} delta={today.orders - yesterday.orders} />
      <KPICard title="Revenue MTD" value={thisMonth.revenue} delta={thisMonth.revenue - lastMonth.revenue} />
      <KPICard title="AOV" value={thisMonth.aov} delta={thisMonth.aov - lastMonth.aov} />
      <Suspense><LiveActivity storeId={storeId} /></Suspense>
      <Suspense><AIInsights storeId={storeId} /></Suspense>
    </div>
  );
}
```

---

## 8. Catalog Federation (Linking External Stores)

This is **the differentiator** that turns ShopNova into a Shopify-killer for many merchants. A store owner can plug in another store's API and resell their products with auto-sync.

### Supported Sources (v1)

- Shopify (Storefront API)
- Takealot Marketplace API
- Amazon SP-API
- AliExpress (via Cloudways/AliDropship)
- WooCommerce REST API
- CSV / Google Sheets (low-code option)

### Federation Workflow

1. Merchant clicks "Add federation source" → picks Shopify.
2. OAuth into the upstream Shopify store; ShopNova receives a token.
3. Merchant configures filters: collections to import, markup rules, sync interval.
4. Inngest schedules sync runs (configurable, default every 30 min).
5. Each sync run:
   - Pulls product list from upstream
   - Diffs against `Product` records with matching `externalId`
   - Creates / updates / deactivates as needed
   - Updates inventory and price (with markup applied)
6. Webhooks from upstream update inventory in real-time when supported.

### Sync Runner

```ts
// packages/integrations/src/federation/shopify.ts
export async function syncShopify(linkId: string) {
  const link = await prisma.federationLink.findUniqueOrThrow({ where: { id: linkId } });
  const config = decryptConfig(link.config);
  const client = new ShopifyClient(config);

  const run = await prisma.federationSyncRun.create({
    data: { federationLinkId: linkId, status: "RUNNING" },
  });

  try {
    let cursor: string | undefined;
    let created = 0, updated = 0;

    do {
      const { products, nextCursor } = await client.listProducts({ cursor, limit: 100 });
      for (const upstream of products) {
        const result = await upsertFederatedProduct({
          storeId: link.storeId,
          link,
          upstream,
        });
        if (result.created) created++;
        else updated++;
      }
      cursor = nextCursor;
    } while (cursor);

    await prisma.federationSyncRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", productsCreated: created, productsUpdated: updated, endedAt: new Date() },
    });

    await prisma.federationLink.update({
      where: { id: linkId },
      data: { lastSyncedAt: new Date(), errorMessage: null },
    });
  } catch (err) {
    await prisma.federationSyncRun.update({
      where: { id: run.id },
      data: { status: "FAILED", errors: { message: String(err) }, endedAt: new Date() },
    });
    throw err;
  }
}
```

### Markup Rules

```ts
function applyMarkup(basePrice: number, rule: MarkupRule): number {
  switch (rule.type) {
    case "percentage": return basePrice * (1 + rule.value / 100);
    case "fixed":      return basePrice + rule.value;
    case "tiered":     return applyTieredMarkup(basePrice, rule.tiers);
  }
}
```

### Conflict Strategy

If a federated product already exists in your catalog manually, you choose:
- **Skip** (don't import duplicates)
- **Replace** (federation wins)
- **Merge** (keep your title/description, sync only price + stock)

### Order Routing

When a customer buys a federated product, ShopNova has two modes:

- **MIRROR mode**: You stocked the item yourself; just fulfill normally.
- **DROPSHIP mode**: Place an order on the upstream automatically (using stored credentials), and ship to the end customer.

### Disclaimer & Compliance

- The merchant is responsible for ensuring they have the right to resell the upstream products.
- ShopNova displays a configurable disclaimer ("Shipped by a partner") on federated SKUs.
- Returns flow back to the upstream when in DROPSHIP mode.

---

## 9. AI Merchandising & Personalization

### A. Auto-Generated Product Copy

When a merchant creates a product, AI generates the description, SEO title, and meta description from a few inputs:

```ts
// packages/ai/src/agents/product-copy.ts
export async function generateProductCopy(input: {
  title: string;
  imageUrls: string[];
  bulletPoints?: string[];
  targetAudience?: string;
  tone?: "professional" | "playful" | "luxurious";
  language?: string;
}) {
  const result = await generateObject({
    model: anthropic("claude-opus-4-7"),
    schema: z.object({
      description: z.string(),
      seoTitle: z.string().max(60),
      seoDescription: z.string().max(160),
      bulletPoints: z.array(z.string()).max(6),
      tags: z.array(z.string()).max(8),
    }),
    messages: [{
      role: "user",
      content: [
        { type: "text", text: COPY_PROMPT(input) },
        ...input.imageUrls.map(url => ({ type: "image" as const, image: url })),
      ],
    }],
  });
  return result.object;
}
```

### B. Vector Search

Every product gets a multi-modal embedding (text + image avg). Stored in pgvector.

```sql
CREATE INDEX ON "Product" USING hnsw ("embedding" vector_cosine_ops);
```

Queries:

```ts
export async function semanticSearch(storeId: string, query: string, limit = 24) {
  const queryEmbedding = await embed(query);
  const results = await prisma.$queryRaw<Product[]>`
    SELECT *, 1 - (embedding <=> ${queryEmbedding}::vector) AS similarity
    FROM "Product"
    WHERE "storeId" = ${storeId} AND "status" = 'ACTIVE'
    ORDER BY embedding <=> ${queryEmbedding}::vector
    LIMIT ${limit}
  `;
  return results;
}
```

Combined with Meilisearch for keyword + typo tolerance:

```ts
async function hybridSearch(storeId: string, query: string) {
  const [vector, keyword] = await Promise.all([
    semanticSearch(storeId, query, 50),
    meilisearch.index(`store-${storeId}`).search(query, { limit: 50 }),
  ]);
  return reciprocalRankFusion([vector, keyword]);
}
```

### C. Image Enhancement Pipeline

For every uploaded product image, run a background job that:
1. Removes the background (Replicate / `rembg`)
2. Upscales to 2x with `clarity-upscaler`
3. Generates an alt text (Claude Vision)
4. Detects dominant colors for theme
5. Creates a square crop for collection thumbnails

```ts
export const enhanceProductImage = inngest.createFunction(
  { id: "enhance-product-image" },
  { event: "product/image.uploaded" },
  async ({ event, step }) => {
    const { imageId } = event.data;

    const enhanced = await step.run("enhance", async () => {
      return await replicate.run("rembg/u2net", { image: event.data.url });
    });

    const altText = await step.run("alt-text", async () => {
      return await generateAltText(enhanced.url);
    });

    await step.run("save", async () => {
      await prisma.productImage.update({
        where: { id: imageId },
        data: { url: enhanced.url, altText },
      });
    });
  }
);
```

### D. Personalized Recommendations

Three signals:
- **Content-based**: vector similarity from current product
- **Collaborative**: customers who bought X also bought Y (precomputed daily)
- **Behavioral**: real-time clickstream, session basket

Combine via weighted blending:

```ts
async function getRecommendations(productId: string, customerId?: string) {
  const [content, collab, personal] = await Promise.all([
    contentBasedRecs(productId, 20),
    collaborativeRecs(productId, 20),
    customerId ? personalizedRecs(customerId, 20) : Promise.resolve([]),
  ]);
  return blend([content, collab, personal], [0.4, 0.4, 0.2]).slice(0, 8);
}
```

### E. Conversational Shopping Agent

Sidebar chat that understands:
- "Show me red dresses under R 1500"
- "I need a gift for my mom's 60th"
- "Compare these two models"

Uses tool calls into product search, cart, and order history.

---

## 10. Cart, Checkout & Payments

### Checkout Steps

1. **Cart** → Customer reviews items
2. **Information** → Email + shipping address (with autocomplete)
3. **Shipping** → Pick a method (rates fetched live from carriers)
4. **Payment** → Card / EFT / Apple Pay / Google Pay / Yoco / SnapScan
5. **Confirmation** → Show order, send email

### Shipping Rates

```ts
// packages/integrations/src/courier/quote.ts
export async function getShippingQuotes(input: {
  origin: Address;
  destination: Address;
  parcels: Parcel[];
}): Promise<ShippingQuote[]> {
  const quotes = await Promise.allSettled([
    bobGoQuote(input),
    aramexQuote(input),
    pudoQuote(input),
    courierGuyQuote(input),
  ]);
  return quotes.flatMap(q => q.status === "fulfilled" ? q.value : []);
}
```

### Payment Gateways

| Gateway | Strengths | When to use |
|---------|-----------|-------------|
| Stripe | Global, reliable | International orders |
| PayFast | SA staple, low fees | All SA orders by default |
| Yoco | Fast SA UX, popular | SA mobile-first stores |
| Stitch | EFT, debit-orders | Subscriptions, B2B |

Allow merchants to enable multiple gateways and route by currency / customer location.

### Payment Flow (Stripe example)

```ts
// app/api/checkout/intent/route.ts
export async function POST(req: Request) {
  const { cartId } = await req.json();
  const cart = await getCart(cartId);

  const intent = await stripe.paymentIntents.create({
    amount: Math.round(Number(cart.total) * 100),
    currency: cart.currency.toLowerCase(),
    metadata: { cartId, storeId: cart.storeId },
    automatic_payment_methods: { enabled: true },
  });

  return Response.json({ clientSecret: intent.client_secret });
}
```

### Fraud Score on Checkout

```ts
async function scoreFraud(cart: Cart, customerInput: CheckoutInput) {
  const factors = {
    customerHistory: await getCustomerHistoryScore(customerInput.email),
    deviceFingerprint: customerInput.deviceFingerprint,
    velocityScore: await getCheckoutVelocity(customerInput.email, customerInput.ip),
    addressMatch: addressVsBin(customerInput.shippingAddress, customerInput.cardBin),
    aiRiskAssessment: await aiRiskAssess(cart, customerInput),
  };
  return computeRiskScore(factors);  // 0–1
}
```

If score > 0.7 → flag for human review or require 3DS step-up.

---

## 11. Order Lifecycle & Fulfillment

### Order State Machine

```
PENDING_PAYMENT → PAID → FULFILLING → SHIPPED → DELIVERED → CLOSED
                                ↓
                          REFUND_REQUESTED → REFUNDED
                                ↓
                            CANCELLED
```

### Auto-Fulfillment Workflow

When `order.created` fires:

1. **Risk check** — if score >0.5, hold for review.
2. **Inventory commitment** — decrement `available`, increment `committed`.
3. **Choose fulfillment location** — closest with full stock.
4. **Generate pick list** for warehouse.
5. **Book courier** (Bob Go API picks cheapest).
6. **Print label** + insert in queue.
7. **Update tracking** — webhook from carrier updates customer.

### AI Order Triage Agent

```ts
export async function triageOrder(orderId: string) {
  const order = await getFullOrder(orderId);
  const checks = await Promise.all([
    checkInventory(order),
    checkFraudScore(order),
    checkFulfillability(order),
    checkUnusualPatterns(order),
  ]);

  if (checks.every(c => c.ok)) return autoFulfill(order);
  return holdForReview(order, checks);
}
```

### Returns Workflow

1. Customer requests return via portal.
2. Customer Service Agent reviews (AI suggests approve/reject based on policy).
3. If approved, generate return label + email instructions.
4. On receipt, inspect, restock or scrap.
5. Process refund through original payment method.

### Subscription Orders

Optional add-on. Use Stripe Subscriptions; ShopNova syncs back to native order objects so analytics include them.

---

## 12. Inventory Management

### Multi-Location

A store has N locations (warehouses, stores, dropship sources). Each location holds an `InventoryLevel` per `InventoryItem`.

### Movements

Every change writes an `InventoryMovement` record (immutable). This is the source of truth; `InventoryLevel` is a materialized cache.

```ts
async function recordMovement(input: {
  itemId: string;
  locationId: string;
  type: MovementType;
  quantity: number;
  reference?: string;
}) {
  await prisma.$transaction([
    prisma.inventoryMovement.create({ data: input }),
    prisma.inventoryLevel.upsert({
      where: { inventoryItemId_locationId: { ... } },
      update: { available: { increment: signedQuantity(input) } },
      create: { ... },
    }),
  ]);
}
```

### Replenishment Agent

Daily job:
1. For every variant, compute weeks-of-supply.
2. If <2 weeks, draft a purchase order to the supplier.
3. AI predicts demand spike (seasonality, marketing campaigns) and adjusts.

```ts
const lowStock = await prisma.inventoryLevel.findMany({
  where: { available: { lt: 10 } },
  include: { inventoryItem: { include: { variants: { include: { product: true } } } } },
});

for (const level of lowStock) {
  const forecast = await forecastDemand(level.inventoryItem.id, 14); // 14 days
  if (level.available < forecast.expected * 1.2) {
    await createPurchaseOrderDraft({
      itemId: level.inventoryItem.id,
      quantity: Math.ceil(forecast.expected * 4),
      reason: "AI replenishment",
    });
  }
}
```

### Stocktake / Cycle Counts

Mobile-friendly UI: scan barcode, enter actual count, system computes variance.

---

## 13. Marketing & Customer Engagement

### Email Campaigns

Use Resend for transactional + Customer.io for campaigns.

Templates:
- Welcome series (3 emails over 7 days)
- Cart abandonment (1h, 24h, 72h)
- Post-purchase (review request after 14 days)
- Win-back (after 60 days no orders)
- VIP perks (top 5% spenders)

### AI-Drafted Campaigns

```ts
export async function draftCampaign(input: {
  segmentId: string;
  goal: "win-back" | "promote-collection" | "new-arrival";
  collectionId?: string;
  brandVoice: string;
}) {
  const segment = await getSegmentSummary(input.segmentId);
  return await generateObject({
    model: anthropic("claude-opus-4-7"),
    schema: CampaignSchema,
    prompt: CAMPAIGN_PROMPT(input, segment),
  });
}
```

Returned shape:
- Subject line (3 variants for A/B test)
- Preheader
- Body (HTML + plaintext)
- Send time recommendation
- Predicted open rate (based on historical)

### Loyalty Program

Built-in points system:
- 1 point per R 10 spent
- 100 points = R 50 voucher
- VIP tiers unlock free shipping, early access

### SMS / WhatsApp

Twilio Conversations + WhatsApp Business API for:
- Order updates
- Abandonment recovery (if customer opted in)
- Customer support chat

### Reviews & UGC

After delivery, automated review request.
- Photo reviews boosted in display
- AI moderates for spam, abuse
- Ratings filter into product pages and ad creative

---

## 14. Analytics & Reporting

### ClickHouse for Events

Every store action emits an event:

```ts
await analytics.track({
  storeId,
  customerId,
  event: "product_viewed",
  properties: { productId, source },
  timestamp: new Date(),
});
```

ClickHouse stores billions of these for sub-second analytics.

### Dashboards

- Sales by day / week / month (with comparison)
- Cohort retention
- Funnel: visit → product view → add to cart → checkout → purchase
- Channel attribution (UTM-based)
- Geography heatmap
- Top products by revenue, units, view-to-purchase
- Customer LTV
- Inventory turnover

### Ask ShopNova (Natural Language BI)

```
"Show me last month's revenue by collection compared to the same month last year"
"Which products have a high view-to-cart rate but low cart-to-checkout rate?"
"What's the LTV of customers who bought from the Summer 2025 collection?"
```

Implemented as text-to-SQL over ClickHouse with row-level filters.

### Cohort Builder

Visual cohort builder: "Customers who first purchased in Jan 2026 and bought >R 500 of accessories." Save as `CustomerSegment`.

---

## 15. Webhook & Event Architecture

Every meaningful event fires both internal Inngest events and outbound webhooks (for merchant integrations).

### Event Catalog

| Event | Internal Subscribers | Webhook Topic |
|-------|---------------------|---------------|
| `product.created` | Search reindex, Embedding job | `products/create` |
| `product.updated` | Search reindex, Embedding refresh | `products/update` |
| `product.deleted` | Search remove | `products/delete` |
| `inventory.changed` | Low-stock alerts | `inventory/levels.update` |
| `order.created` | Triage agent, fulfillment | `orders/create` |
| `order.paid` | Fulfillment trigger | `orders/paid` |
| `order.fulfilled` | Notify customer | `orders/fulfilled` |
| `customer.created` | Welcome series | `customers/create` |
| `cart.abandoned` | Recovery email | `checkouts/abandoned` |

### Outbound Delivery

```ts
export const deliverWebhook = inngest.createFunction(
  { id: "deliver-webhook", retries: 5 },
  { event: "webhook/dispatch" },
  async ({ event, step }) => {
    const { endpointId, topic, payload } = event.data;
    const endpoint = await getEndpoint(endpointId);

    const signature = sign(JSON.stringify(payload), endpoint.secret);

    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ShopNova-Topic": topic,
        "X-ShopNova-Signature": signature,
        "X-ShopNova-Timestamp": String(Date.now()),
      },
      body: JSON.stringify(payload),
    });

    await prisma.webhookDelivery.create({
      data: {
        endpointId,
        topic,
        payload,
        responseStatus: res.status,
        succeeded: res.ok,
      },
    });

    if (!res.ok) throw new Error(`Webhook failed: ${res.status}`);
  }
);
```

---

## 16. Testing & Evals

Same pyramid as PropFlow. Specific to ShopNova:

### Critical Test Cases

- Cart calculation across multiple discount types
- Tax computation for SA VAT (15%) + zero-rated items
- Multi-currency conversion correctness
- Inventory race conditions (two checkouts of last item)
- Webhook signature verification
- Subscription proration

### AI Evals

| Agent | Eval Metric |
|-------|-------------|
| Product copy generator | Brand voice consistency, length compliance, factual accuracy from photos |
| Search ranker | NDCG@10 vs human-labeled relevance |
| Recommendation engine | CTR uplift vs popularity baseline (A/B in production) |
| Fraud scorer | AUC vs labeled chargeback dataset |
| Customer service agent | CSAT score, escalation rate |

---

## 17. DevOps & Deployment

Same baseline as PropFlow. Specific differences:

- **Storefront** deployed to Vercel for global edge.
- **Admin** deployed to Vercel.
- **Workers** on Fly.io (always-on, Inngest connectors).
- **ClickHouse** as managed service (ClickHouse Cloud).
- **Meilisearch** self-hosted on Fly.io or via Meili Cloud.
- **Redis** via Upstash (serverless).

### Performance Audits

Run k6 weekly:
- 1000 RPS on product page (cached): <50ms p95
- 500 RPS on add-to-cart: <100ms p95
- 100 RPS on checkout intent: <300ms p95

---

## 18. Compliance (PCI-DSS Lite, POPIA, GDPR)

### Card Handling

- **Never** store raw card numbers.
- Always use Stripe Elements / PayFast iframes — card data never touches ShopNova servers.
- Use SAQ A as the compliance level (lowest scope).

### Data Subject Rights

- Customer can request data export (JSON dump of their orders, addresses, communications).
- Customer can request deletion (anonymize order records, hard-delete addresses).
- Done via self-service in customer account, plus admin escalation path.

### Cookie Banner & Consent

- Non-essential cookies (analytics, marketing) require explicit consent.
- Maintain consent log per customer / session.
- Comply with POPIA, GDPR, CCPA.

### Tax Compliance

- SA VAT (15%) handled by tax engine.
- For international expansion, integrate Stripe Tax or Vertex.

---

## 19. 12-Sprint Development Roadmap

### Sprint 1 — Foundation
- Monorepo, Next.js 16, Prisma, Postgres, Clerk
- Store CRUD, multi-tenancy enforcement
- Storefront skeleton (home, product list, product page)

### Sprint 2 — Core Catalog
- Products, Variants, Collections
- Image upload to R2 with Cloudflare Images
- Storefront product gallery with ISR

### Sprint 3 — Cart & Checkout
- Cart in Redis
- Checkout flow (info → shipping → payment)
- Stripe + PayFast integration
- Order creation on success

### Sprint 4 — Customer Accounts
- Customer registration, login
- Order history, address book
- Reviews after delivery

### Sprint 5 — Admin Dashboard
- KPI overview
- Order management with filters
- Product CRUD UI
- Inventory levels

### Sprint 6 — Search + Federation Foundation
- Meilisearch integration
- pgvector embeddings on products
- Hybrid search
- Federation framework + Shopify connector

### Sprint 7 — AI Merchandising
- Product copy generator
- Image enhancement pipeline
- Vector recommendations
- Smart collections (rule-based + AI-suggested)

### Sprint 8 — Marketing
- Email service (Resend + Customer.io)
- Cart abandonment workflow
- Discount engine
- Loyalty program

### Sprint 9 — Federation Continued
- Takealot connector
- Amazon SP-API connector
- Order routing for dropship
- Conflict resolution UI

### Sprint 10 — Analytics
- ClickHouse setup
- Event tracking
- Dashboards (sales, funnel, cohorts)
- Ask ShopNova natural-language BI

### Sprint 11 — Operations
- Multi-location inventory
- Replenishment agent
- Returns workflow
- Customer service AI chat

### Sprint 12 — Polish
- Performance audit
- A/B testing framework
- Documentation
- Demo store with realistic data

---

## 20. Acceptance Criteria & Demo Script

### Demo Script (15 min)

1. **Store setup** (2m) — Create store, choose theme, customize colors.
2. **Product creation with AI** (2m) — Upload photos, AI generates copy + tags.
3. **Federation** (3m) — Link a Shopify store; watch sync run; products appear with markup.
4. **Customer journey** (3m) — Search using natural language; add to cart; checkout with PayFast.
5. **Admin operations** (2m) — Order appears; AI triages, fulfills, books courier.
6. **AI insights** (2m) — Ask ShopNova: "Which collections drove growth this month?"
7. **Marketing** (1m) — Show abandonment recovery email firing in real-time.

---

## 21. Stretch Goals

1. **B2B commerce** — Quote requests, net-30 terms, bulk pricing
2. **Subscriptions** — Recurring orders, customer-managed cadence
3. **Live shopping** — Streamed video with shoppable overlays
4. **Voice commerce** — "Hey ShopNova, reorder my last purchase"
5. **POS** — Tablet-based in-store checkout sharing inventory
6. **AR try-on** — For fashion / beauty
7. **Dynamic pricing** — Match competitors automatically
8. **Marketplace mode** — Multi-vendor like Etsy
9. **AI photographer** — Generate product photography from sketches
10. **Headless mode** — Deliver content via Storyblok / Sanity, ShopNova powers commerce only

---

## 22. Resources

- Shopify dev docs (study their API design): https://shopify.dev
- Vercel Commerce: https://github.com/vercel/commerce
- Medusa.js (study, then build better): https://medusajs.com
- The Lemon Stand commerce playbook
- Klaviyo, Yotpo, ShipBob for ops inspiration
- South African ecosystem: Takealot, Bob Go, Yoco docs

---

**End of Guidebook 2 — ShopNova.**

> The student who finishes this graduates with the rare combination of full-stack engineering, payment systems mastery, recommendation systems, and a working clone of one of the world's most valuable B2B SaaS categories.
