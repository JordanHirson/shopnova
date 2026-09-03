/**
 * Mock federation source connectors (GUIDEBOOK §8).
 *
 * This is a DEMO-only stand-in for the real per-source connectors described
 * in the GUIDEBOOK (Shopify Storefront API, Amazon SP-API, Takealot
 * Marketplace API, AliExpress via Cloudways/AliDropship, WooCommerce REST
 * API, CSV/Google Sheets). Instead of calling each upstream's servers it
 * returns a fixed, realistic, source-specific product catalog so the
 * federation demo can run with no external credentials, no network, and no
 * chance of failure.
 *
 * The shape of `UpstreamProduct` mirrors what a real source client would
 * return, so the sync runner (`lib/db/federation.ts`) is written exactly as
 * the GUIDEBOOK prescribes — only the data source is mocked. Swapping this
 * file for real per-source clients later requires no changes to the runner.
 */

export interface UpstreamProduct {
  /** Upstream product id (gid, ASIN, etc.). */
  externalId: string
  title: string
  description: string
  /** Base price in the upstream currency, before markup. */
  price: number
  sku: string
  imageUrl: string
  /** Available inventory reported by the upstream store. */
  inventory: number
}

export type MockSource =
  | "shopify"
  | "amazon"
  | "takealot"
  | "aliexpress"
  | "woocommerce"
  | "csv"

/**
 * Simulates `<SourceClient>.listProducts({ cursor, limit })` for the given
 * source. Returns the full mock catalog in one page (no pagination needed
 * for the demo) with a `null` nextCursor to terminate the sync loop.
 *
 * A tiny artificial delay is added so the "sync running" state is visible.
 */
export async function listMockProducts(
  source: string
): Promise<{ products: UpstreamProduct[]; nextCursor: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 600))

  const products = CATALOGS[source as MockSource] ?? CATALOGS.shopify
  return { products, nextCursor: null }
}

// ── Per-source mock catalogs ──────────────────────────────────────────

const CATALOGS: Record<MockSource, UpstreamProduct[]> = {
  // Shopify — lifestyle gadgets & home accessories
  shopify: [
    {
      externalId: "shopify-1001",
      title: "Aurora Wireless Earbuds",
      description:
        "Bluetooth 5.3 earbuds with active noise cancellation, 28h total battery, and USB-C fast charging.",
      price: 59.0,
      sku: "AUR-EARB-001",
      imageUrl:
        "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80",
      inventory: 120,
    },
    {
      externalId: "shopify-1002",
      title: "Nimbus Smart Water Bottle",
      description:
        "Insulated 500ml bottle with temperature display and hydration reminders via companion app.",
      price: 24.5,
      sku: "NIM-BOTL-002",
      imageUrl:
        "https://images.unsplash.com/photo-1602143407151-7111547de24e?w=600&q=80",
      inventory: 85,
    },
    {
      externalId: "shopify-1003",
      title: "Terra Bamboo Desk Organizer",
      description:
        "Sustainable bamboo organizer with compartments for stationery, phone, and accessories.",
      price: 18.0,
      sku: "TER-ORG-003",
      imageUrl:
        "https://images.unsplash.com/photo-1518733057094-95b53143d2b7?w=600&q=80",
      inventory: 60,
    },
    {
      externalId: "shopify-1004",
      title: "Lumen LED Desk Lamp",
      description:
        "Dimmable LED lamp with 3 color temperatures and a wireless charging base.",
      price: 42.0,
      sku: "LUM-LAMP-004",
      imageUrl:
        "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80",
      inventory: 40,
    },
    {
      externalId: "shopify-1005",
      title: "Drift Aromatherapy Diffuser",
      description:
        "Ultrasonic essential oil diffuser with 7-color ambient lighting and auto shut-off.",
      price: 31.5,
      sku: "DRF-DIFF-005",
      imageUrl:
        "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&q=80",
      inventory: 70,
    },
    {
      externalId: "shopify-1006",
      title: "Pulse Fitness Tracker Band",
      description:
        "Lightweight wristband tracking heart rate, steps, and sleep with 10-day battery life.",
      price: 38.0,
      sku: "PLS-TRK-006",
      imageUrl:
        "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=600&q=80",
      inventory: 95,
    },
  ],

  // AliExpress — budget electronics & gadgets (via Cloudways/AliDropship)
  aliexpress: [
    {
      externalId: "ali-2001",
      title: "Mini Portable Projector",
      description:
        "1080p-supported LED projector with HDMI and USB, native 480p, 1500 lumens.",
      price: 32.0,
      sku: "ALI-PROJ-201",
      imageUrl:
        "https://images.unsplash.com/photo-1626379953822-baec19c3accd?w=600&q=80",
      inventory: 200,
    },
    {
      externalId: "ali-2002",
      title: "Magnetic Wireless Charger Pad",
      description:
        "15W Qi fast wireless charging pad with anti-slip silicone surface and LED indicator.",
      price: 8.5,
      sku: "ALI-CHRG-202",
      imageUrl:
        "https://images.unsplash.com/photo-1591290619762-c2b9a0b8e1f6?w=600&q=80",
      inventory: 500,
    },
    {
      externalId: "ali-2003",
      title: "Foldable Bluetooth Keyboard",
      description:
        "Ultra-slim tri-fold wireless keyboard with touchpad, compatible with phone/tablet/laptop.",
      price: 14.0,
      sku: "ALI-KBD-203",
      imageUrl:
        "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=80",
      inventory: 320,
    },
    {
      externalId: "ali-2004",
      title: "Smart Watch with Call Function",
      description:
        "1.83-inch HD touch smartwatch with Bluetooth calling, heart-rate and SpO2 monitoring.",
      price: 19.5,
      sku: "ALI-WCH-204",
      imageUrl:
        "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80",
      inventory: 410,
    },
    {
      externalId: "ali-2005",
      title: "Mini Drone with Camera",
      description:
        "Foldable drone with 4K camera, altitude hold, and one-key return. 15-min flight time.",
      price: 27.0,
      sku: "ALI-DRN-205",
      imageUrl:
        "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=600&q=80",
      inventory: 150,
    },
  ],

  // Amazon SP-API — broader consumer electronics & home
  amazon: [
    {
      externalId: "amazon-B08X4ABCD1",
      title: "Echo Dot (5th Gen)",
      description:
        "Compact smart speaker with Alexa, improved audio, and built-in temperature sensor.",
      price: 49.99,
      sku: "AMZ-ECHO-501",
      imageUrl:
        "https://images.unsplash.com/photo-1543512214-318cbb5db691?w=600&q=80",
      inventory: 300,
    },
    {
      externalId: "amazon-B07XJ8C8F5",
      title: "Kindle Paperwhite (16GB)",
      description:
        "6.8-inch glare-free display, waterproof, weeks of battery, adjustable warm light.",
      price: 149.99,
      sku: "AMZ-KDL-502",
      imageUrl:
        "https://images.unsplash.com/photo-1592434134753-a70baf7979d5?w=600&q=80",
      inventory: 180,
    },
    {
      externalId: "amazon-B092QF3Y6K",
      title: "Fire TV Stick 4K Max",
      description:
        "Streaming stick with Wi-Fi 6, Dolby Vision, Atmos, and Alexa Voice Remote.",
      price: 39.99,
      sku: "AMZ-FTV-503",
      imageUrl:
        "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&q=80",
      inventory: 240,
    },
    {
      externalId: "amazon-B08N5WRWNW",
      title: "Ring Video Doorbell (Wired)",
      description:
        "1080p HD video doorbell with two-way talk, motion alerts, and night vision.",
      price: 64.99,
      sku: "AMZ-RNG-504",
      imageUrl:
        "https://images.unsplash.com/photo-1558002038-1055907df827?w=600&q=80",
      inventory: 95,
    },
  ],

  // Takealot — South African marketplace essentials
  takealot: [
    {
      externalId: "takealot-PLID9801",
      title: "Defy 4-Slice Toaster",
      description:
        "Stainless steel toaster with variable browning control and defrost/reheat functions.",
      price: 399.0,
      sku: "TKL-TST-801",
      imageUrl:
        "https://images.unsplash.com/photo-1585659722983-3a30ba0f9e9e?w=600&q=80",
      inventory: 45,
    },
    {
      externalId: "takealot-PLID9802",
      title: "Russell Hobbs Kettle 1.7L",
      description:
        "Cordless electric kettle with 2200W rapid boil, removable filter, and water-level window.",
      price: 349.0,
      sku: "TKL-KTL-802",
      imageUrl:
        "https://images.unsplash.com/photo-1517048676732-d65bc937f957?w=600&q=80",
      inventory: 60,
    },
    {
      externalId: "takealot-PLID9803",
      title: "Camp Master Folding Chair",
      description:
        "Padded camping chair with cup holder, steel frame, and 120kg weight capacity.",
      price: 199.0,
      sku: "TKL-CMP-803",
      imageUrl:
        "https://images.unsplash.com/photo-1504280390367-361c6d9f38f5?w=600&q=80",
      inventory: 110,
    },
    {
      externalId: "takealot-PLID9804",
      title: "Cadbury Dairy Milk Slab 80g",
      description:
        "Classic milk chocolate slab. Pack of 12. Halaal certified.",
      price: 159.0,
      sku: "TKL-CDB-804",
      imageUrl:
        "https://images.unsplash.com/photo-1548907040-4baa4b9f2f79?w=600&q=80",
      inventory: 500,
    },
  ],

  // WooCommerce — artisan / handmade goods
  woocommerce: [
    {
      externalId: "woo-3001",
      title: "Handwoven Cotton Throw Blanket",
      description:
        "Loom-woven 100% cotton throw with fringed edges. Ethically made in small batches.",
      price: 68.0,
      sku: "WOO-THRW-301",
      imageUrl:
        "https://images.unsplash.com/photo-1600166898405-da9535204843?w=600&q=80",
      inventory: 25,
    },
    {
      externalId: "woo-3002",
      title: "Hand-Poured Soy Candle Set",
      description:
        "Set of 3 soy-wax candles (cedar, vanilla, eucalyptus) in reusable amber glass jars.",
      price: 34.0,
      sku: "WOO-CNDL-302",
      imageUrl:
        "https://images.unsplash.com/photo-1602874801006-7c1c9c9c7c9c?w=600&q=80",
      inventory: 80,
    },
    {
      externalId: "woo-3003",
      title: "Leather-Bound Travel Journal",
      description:
        "A5 refillable journal with full-grain leather cover and 200 pages of acid-free paper.",
      price: 45.0,
      sku: "WOO-JRNL-303",
      imageUrl:
        "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600&q=80",
      inventory: 40,
    },
    {
      externalId: "woo-3004",
      title: "Stoneware Coffee Mug (Handmade)",
      description:
        "Wheel-thrown stoneware mug with matte glaze. Microwave and dishwasher safe.",
      price: 22.0,
      sku: "WOO-MUG-304",
      imageUrl:
        "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&q=80",
      inventory: 55,
    },
  ],

  // CSV / Google Sheets — generic low-code import
  csv: [
    {
      externalId: "csv-row-1",
      title: "Generic USB-C Cable 2m",
      description: "Braided nylon USB-C to USB-A charging/sync cable, 2 metres.",
      price: 5.0,
      sku: "CSV-USBC-001",
      imageUrl:
        "https://images.unsplash.com/photo-1588872657639-5b9c1e9c9c9c?w=600&q=80",
      inventory: 1000,
    },
    {
      externalId: "csv-row-2",
      title: "Screen Protector Pack (3)",
      description: "Tempered glass screen protectors, universal fit, 3-pack.",
      price: 4.5,
      sku: "CSV-SCRN-002",
      imageUrl:
        "https://images.unsplash.com/photo-1592434134753-a70baf7979d5?w=600&q=80",
      inventory: 2000,
    },
    {
      externalId: "csv-row-3",
      title: "Phone Stand Adjustable",
      description: "Aluminium desktop phone stand, foldable, adjustable angle.",
      price: 7.0,
      sku: "CSV-STND-003",
      imageUrl:
        "https://images.unsplash.com/photo-1601784551446-7c8b6b6c9c9c?w=600&q=80",
      inventory: 750,
    },
  ],
}
