/**
 * ShopNova - AI-assisted product creation (Demo Step 2).
 *
 * Accepts product keywords and/or a base64 image / image URL and returns
 * structured JSON the product form can autofill: title, description, tags,
 * suggestedPrice, and a categorySlug that maps to one of the store's
 * existing categories.
 *
 * When OPENAI_API_KEY (or AI_API_KEY) is set, the route calls an
 * OpenAI-compatible Chat Completions API with JSON response mode. The base
 * URL and model are configurable via AI_BASE_URL and AI_MODEL so any
 * OpenAI-compatible provider works (OpenAI, Google Gemini, Groq,
 * OpenRouter, etc.). Defaults to OpenAI's endpoint + gpt-4o-mini.
 *
 * When no key is configured (the default for local demos), a deterministic
 * mock generator runs instead so the demo always succeeds instantly
 * without credentials.
 *
 * No new dependency is introduced: the LLM call uses the native `fetch`.
 * The mock fallback is the primary demo path.
 */
import { z } from "zod"

import { requireAdmin, AdminRequiredError, UnauthenticatedError } from "@/lib/auth/admin"
import { listCategories } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const requestBodySchema = z.object({
  keywords: z.string().max(500).optional(),
  imageBase64: z.string().max(2_000_000).optional(),
  imageUrl: z.string().url().max(2048).optional(),
})

const generatedProductSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000),
  tags: z.array(z.string()).max(8).default([]),
  suggestedPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  categorySlug: z.string().min(1).max(255),
})

export type GeneratedProduct = z.infer<typeof generatedProductSchema>

export async function POST(req: Request) {
  // SECURITY: only admins may invoke AI generation (it can call a paid
  // external API and reads the store's category list).
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return Response.json({ error: "Authentication required." }, { status: 401 })
    }
    if (err instanceof AdminRequiredError) {
      return Response.json({ error: "Admin access required." }, { status: 403 })
    }
    return Response.json({ error: "Authorization failed." }, { status: 401 })
  }

  let parsedBody: z.infer<typeof requestBodySchema>
  try {
    const json = await req.json()
    parsedBody = requestBodySchema.parse(json)
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 })
  }

  const categories = await listCategories()
  const categorySlugs = categories.map((c) => ({ slug: c.slug, name: c.name }))

  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY
  if (apiKey) {
    try {
      const result = await generateWithLLM(apiKey, parsedBody, categorySlugs)
      return Response.json(result)
    } catch (err) {
      // Fall back to the mock so a flaky/key-limited demo still works.
      console.warn(
        "[ai/generate-product] LLM call failed, using mock fallback:",
        err instanceof Error ? err.message : err
      )
    }
  }

  const fallback = mockGenerate(parsedBody, categorySlugs)
  return Response.json(fallback)
}

/**
 * Calls an OpenAI-compatible Chat Completions API with JSON response mode
 * and parses the result into the validated `GeneratedProduct` shape.
 *
 * The base URL and model are configurable via AI_BASE_URL and AI_MODEL so
 * any OpenAI-compatible provider works (OpenAI, Google Gemini, Groq,
 * OpenRouter, etc.). Defaults to OpenAI's endpoint + gpt-4o-mini.
 */
async function generateWithLLM(
  apiKey: string,
  input: z.infer<typeof requestBodySchema>,
  categories: { slug: string; name: string }[]
): Promise<GeneratedProduct> {
  const baseUrl = (process.env.AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "")
  const model = process.env.AI_MODEL ?? "gpt-4o-mini"

  const categoryList = categories.map((c) => `${c.slug} (${c.name})`).join(", ") || "none"

  const userText = [
    input.keywords ? `Keywords/concept: ${input.keywords}` : null,
    input.imageUrl ? `Image URL: ${input.imageUrl}` : null,
    input.imageBase64 ? "An image was provided (base64)." : null,
    `Available store categories (pick the best matching slug): ${categoryList}`,
  ]
    .filter(Boolean)
    .join("\n")

  const systemPrompt = [
    "You are an e-commerce merchandising assistant.",
    "Generate product details for a merchant's new product based on the provided keywords and/or image.",
    "Respond with a single JSON object exactly matching this shape:",
    '{"title": string, "description": string, "tags": string[], "suggestedPrice": string (e.g. "129.99"), "categorySlug": string}',
    "The categorySlug MUST be one of the provided store category slugs. If none fit, still pick the closest one.",
    "Keep the title under 60 chars, description under 500 chars, and tags to 3-6 short lowercase keywords.",
  ].join(" ")

  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userText },
  ]

  // If a base64 image was supplied, send it as a vision image_url message.
  if (input.imageBase64) {
    const dataUrl = input.imageBase64.startsWith("data:")
      ? input.imageBase64
      : `data:image/jpeg;base64,${input.imageBase64}`
    messages.push({
      role: "user",
      content: [
        { type: "text", text: "Use this product photo to generate the details." },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    })
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    throw new Error(`LLM responded ${res.status}: ${await res.text()}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("LLM returned no content.")

  const parsed = generatedProductSchema.parse(JSON.parse(content))
  return parsed
}

/**
 * Deterministic mock generator. Produces realistic, varied product details
 * based on the input keywords so the demo always succeeds instantly even
 * without an API key. Picks a category slug that exists in the store.
 *
 * When the keywords match a known archetype (audio, apparel, etc.) the
 * archetype's polished copy is used. Otherwise a title is derived from the
 * user's keywords so the fallback still reflects what they typed instead
 * of always returning a generic "New Product".
 */
function mockGenerate(
  input: z.infer<typeof requestBodySchema>,
  categories: { slug: string; name: string }[]
): GeneratedProduct {
  const raw = (input.keywords ?? "").trim().toLowerCase()
  const text = raw || (input.imageUrl ? "product" : "")

  const archetype = pickArchetype(text)
  const isGeneric = archetype === DEFAULT_ARCHETYPE

  // Choose a category slug: prefer a store category whose name/slug shares
  // a word with the archetype, else the first category, else a safe default.
  const matchedSlug =
    categories.find((c) =>
      archetype.keywords.some((k) => c.slug.includes(k) || c.name.toLowerCase().includes(k))
    )?.slug ??
    categories[0]?.slug ??
    "general"

  // For the generic fallback, build a title from the user's keywords so the
  // result reflects their input (e.g. "red sneakers" -> "Red Sneakers")
  // rather than always "New Product".
  if (isGeneric && raw) {
    const keywordTitle = titleCase(raw)
    const keywordTags = raw
      .split(/[\s,]+/)
      .filter((w) => w.length > 2)
      .slice(0, 5)
    return {
      title: keywordTitle.slice(0, 255) || archetype.title,
      description: archetype.description,
      tags: keywordTags.length ? keywordTags : archetype.tags,
      suggestedPrice: archetype.price,
      categorySlug: matchedSlug,
    }
  }

  return {
    title: archetype.title,
    description: archetype.description,
    tags: archetype.tags,
    suggestedPrice: archetype.price,
    categorySlug: matchedSlug,
  }
}

/** Title-cases a raw keyword string (e.g. "red sneakers" -> "Red Sneakers"). */
function titleCase(value: string): string {
  return value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

interface Archetype {
  keywords: string[]
  title: string
  description: string
  tags: string[]
  price: string
}

const ARCHETYPES: Archetype[] = [
  {
    keywords: ["headphone", "headphones", "audio", "earphone", "earbuds", "speaker", "sound"],
    title: "Wireless Noise-Cancelling Headphones",
    description:
      "Immerse yourself in studio-grade audio with these wireless noise-cancelling headphones. Featuring 40-hour battery life, plush memory-foam ear cushions, and Bluetooth 5.3 with multipoint pairing, they deliver crystal-clear calls and deep, balanced bass for all-day listening comfort.",
    tags: ["audio", "wireless", "bluetooth", "noise-cancelling", "premium"],
    price: "129.99",
  },
  {
    keywords: ["mouse", "keyboard", "desk", "computer", "laptop", "usb", "gaming"],
    title: "Ergonomic Wireless Mouse",
    description:
      "A precision wireless mouse engineered for all-day comfort. The sculpted ergonomic shape reduces wrist strain, while the 4000 DPI optical sensor tracks flawlessly on any surface. Silent clicks, a USB-C fast charge, and programmable side buttons keep you productive without the noise.",
    tags: ["accessories", "wireless", "ergonomic", "office", "usb-c"],
    price: "34.99",
  },
  {
    keywords: ["coffee", "mug", "cup", "drink", "kitchen", "bottle", "tumbler"],
    title: "Ceramic Coffee Mug",
    description:
      "Start every morning right with this hand-glazed ceramic coffee mug. Double-wall insulation keeps your brew hot for longer, the comfortable handle fits any grip, and the matte finish adds a touch of understated style to your kitchen or desk. Dishwasher and microwave safe.",
    tags: ["kitchen", "ceramic", "coffee", "gift", "everyday"],
    price: "14.99",
  },
  {
    keywords: ["shirt", "tee", "tshirt", "apparel", "clothing", "fashion", "cotton"],
    title: "Premium Cotton T-Shirt",
    description:
      "A wardrobe essential cut from 100% combed organic cotton for a soft, breathable feel that lasts. The modern tailored fit, reinforced collar, and pre-shrunk fabric mean it looks great wash after wash. Ethically made and available in a range of classic colours.",
    tags: ["apparel", "cotton", "casual", "unisex", "organic"],
    price: "24.99",
  },
  {
    keywords: ["phone", "case", "charger", "cable", "mobile", "smartphone"],
    title: "Phone Charging Cable",
    description:
      "A durable braided charging cable that delivers fast, reliable power and data sync. Reinforced stress points resist fraying, the tangle-free nylon braid coils neatly, and universal USB-C compatibility works with phones, tablets, and laptops. MFi certified for safe, stable charging.",
    tags: ["accessories", "charging", "usb-c", "braided", "fast-charge"],
    price: "12.99",
  },
  {
    keywords: ["candle", "home", "decor", "scent", "soy", "aroma"],
    title: "Soy Wax Scented Candle",
    description:
      "Hand-poured from natural soy wax with a cotton wick, this scented candle fills your space with a warm, lingering fragrance for up to 45 hours. The minimalist glass vessel doubles as decor, and the clean burn produces no soot. A perfect gift or self-care accent for any room.",
    tags: ["home", "decor", "candle", "soy-wax", "gift"],
    price: "19.99",
  },
]

const DEFAULT_ARCHETYPE: Archetype = {
  keywords: [],
  title: "New Product",
  description:
    "A versatile new addition to your catalog, thoughtfully designed for everyday use. Crafted from quality materials with attention to detail, it balances style and practicality to meet your customers' needs. Add your own specifics to round out the story.",
  tags: ["new", "featured", "quality"],
  price: "29.99",
}

function pickArchetype(text: string): Archetype {
  if (!text) return DEFAULT_ARCHETYPE
  for (const a of ARCHETYPES) {
    if (a.keywords.some((k) => text.includes(k))) return a
  }
  return DEFAULT_ARCHETYPE
}
