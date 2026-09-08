/**
 * ShopNova - Conversational AI insights (Demo Step 6).
 *
 * Answers merchant questions such as "Which collections drove growth this
 * month?" by aggregating `orderItem` revenue by product category, comparing
 * the current calendar month against the previous one, and returning a
 * concise natural-language summary plus supporting mini metric bars.
 *
 * Like the AI product-generation route, when OPENAI_API_KEY (or AI_API_KEY)
 * is set it calls an OpenAI-compatible Chat Completions API to phrase the
 * summary; otherwise a deterministic mock composer runs so the demo always
 * succeeds instantly without credentials. No new dependency is introduced
 * (native `fetch`).
 *
 * SECURITY: only admins may invoke this route (it reads store sales data).
 */
import { z } from "zod"

import { prisma } from "@/lib/db/prisma"
import { getDefaultStoreId } from "@/lib/db/store"
import {
  requireAdmin,
  AdminRequiredError,
  UnauthenticatedError,
} from "@/lib/auth/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const requestBodySchema = z.object({
  question: z.string().max(500).optional(),
})

/** One category's aggregated revenue for a period. */
interface CategoryMetric {
  category: string
  revenue: number
  growthPct: number | null
}

/** Shape returned to the client. */
export interface InsightsResponse {
  answer: string
  metrics: CategoryMetric[]
  currency: string
  periodLabel: string
  totalRevenue: number
  simulated: boolean
}

export async function POST(req: Request) {
  // SECURITY: only admins may read store sales analytics.
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
    const json = await req.json().catch(() => ({}))
    parsedBody = requestBodySchema.parse(json)
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 })
  }

  const storeId = await getDefaultStoreId()
  if (!storeId) {
    return Response.json({ error: "No store configured." }, { status: 404 })
  }

  const metrics = await aggregateCategoryMetrics(storeId)
  const currency = "ZAR"
  const periodLabel = currentMonthLabel()

  const totalRevenue = metrics.reduce((sum, m) => sum + m.revenue, 0)

  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY
  if (apiKey) {
    try {
      const answer = await composeWithLLM(apiKey, parsedBody.question, metrics, currency)
      return Response.json({
        answer,
        metrics,
        currency,
        periodLabel,
        totalRevenue,
        simulated: false,
      } satisfies InsightsResponse)
    } catch (err) {
      console.warn(
        "[ai/insights] LLM call failed, using mock fallback:",
        err instanceof Error ? err.message : err
      )
    }
  }

  const answer = composeMockAnswer(parsedBody.question, metrics, currency)
  return Response.json({
    answer,
    metrics,
    currency,
    periodLabel,
    totalRevenue,
    simulated: true,
  } satisfies InsightsResponse)
}

/**
 * Aggregates order-item revenue by product category for the current calendar
 * month, and computes growth versus the previous calendar month.
 *
 * Growth is `null` when the previous month had zero revenue (cannot divide).
 */
async function aggregateCategoryMetrics(storeId: string): Promise<CategoryMetric[]> {
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  // Pull order items with their product's category for both periods in two
  // queries, then aggregate in JS. This keeps the query simple and avoids
  // needing raw SQL grouping while staying store-scoped.
  const [thisMonthItems, lastMonthItems] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        order: { storeId, createdAt: { gte: thisMonthStart, lt: thisMonthEnd } },
      },
      select: {
        totalPrice: true,
        product: { select: { category: { select: { name: true } } } },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: { storeId, createdAt: { gte: lastMonthStart, lt: thisMonthStart } },
      },
      select: {
        totalPrice: true,
        product: { select: { category: { select: { name: true } } } },
      },
    }),
  ])

  const thisByCategory = new Map<string, number>()
  for (const item of thisMonthItems) {
    const name = item.product.category.name
    thisByCategory.set(name, (thisByCategory.get(name) ?? 0) + Number(item.totalPrice))
  }
  const lastByCategory = new Map<string, number>()
  for (const item of lastMonthItems) {
    const name = item.product.category.name
    lastByCategory.set(name, (lastByCategory.get(name) ?? 0) + Number(item.totalPrice))
  }

  const allCategories = new Set<string>([
    ...thisByCategory.keys(),
    ...lastByCategory.keys(),
  ])

  const metrics: CategoryMetric[] = Array.from(allCategories).map((category) => {
    const revenue = thisByCategory.get(category) ?? 0
    const prev = lastByCategory.get(category) ?? 0
    const growthPct = prev === 0 ? null : Math.round(((revenue - prev) / prev) * 100)
    return { category, revenue, growthPct }
  })

  // Sort by this-month revenue descending so the leading collection is first.
  metrics.sort((a, b) => b.revenue - a.revenue)
  return metrics
}

function currentMonthLabel(): string {
  return new Date().toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  })
}

function formatCurrency(value: number, currency: string): string {
  const symbol = currency === "ZAR" ? "R" : currency
  return `${symbol}${value.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`
}

/**
 * Deterministic mock composer. Builds a concise natural-language summary
 * from the aggregated metrics, mirroring the demo's example phrasing.
 */
function composeMockAnswer(
  question: string | undefined,
  metrics: CategoryMetric[],
  currency: string
): string {
  const q = (question ?? "").toLowerCase()

  if (metrics.length === 0) {
    return "No sales have been recorded yet this month, so there's no collection growth to report yet. Once orders start coming in, I'll rank your categories by revenue and highlight the top growth drivers."
  }

  const leader = metrics[0]
  const runnerUp = metrics[1]

  const growthPhrase =
    leader.growthPct === null
      ? "leading sales"
      : leader.growthPct >= 0
        ? `a ${leader.growthPct}% increase in sales`
        : `a ${Math.abs(leader.growthPct)}% dip in sales`

  const leaderSentence = `The '${leader.category}' collection led growth with ${growthPhrase} this month (${formatCurrency(leader.revenue, currency)} total)`

  const runnerSentence = runnerUp
    ? `, followed by '${runnerUp.category}' (${formatCurrency(runnerUp.revenue, currency)}).`
    : "."

  if (q.includes("best-selling") || q.includes("best selling")) {
    return `Your best-selling category this month is '${leader.category}' with ${formatCurrency(leader.revenue, currency)} in sales${runnerSentence}`
  }

  return `${leaderSentence}${runnerSentence}`
}

/**
 * Calls an OpenAI-compatible Chat Completions API to phrase the summary
 * naturally from the aggregated metrics. The base URL and model are
 * configurable via AI_BASE_URL and AI_MODEL.
 */
async function composeWithLLM(
  apiKey: string,
  question: string | undefined,
  metrics: CategoryMetric[],
  currency: string
): Promise<string> {
  const baseUrl = (process.env.AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "")
  const model = process.env.AI_MODEL ?? "gpt-4o-mini"

  const metricsDigest = metrics
    .map(
      (m) =>
        `${m.category}: ${formatCurrency(m.revenue, currency)} this month${
          m.growthPct === null
            ? ""
            : ` (${m.growthPct >= 0 ? "+" : ""}${m.growthPct}% vs last month)`
        }`
    )
    .join("; ")

  const systemPrompt = [
    "You are ShopNova's merchandising insights assistant for a store owner.",
    "Given the merchant's question and aggregated category revenue data for the current month, write a single concise answer (max 2 sentences).",
    "Lead with the top-growth collection, state its revenue and growth %, and mention the runner-up. Use the currency symbol provided. Be specific and grounded only in the data given.",
  ].join(" ")

  const userText = [
    question ? `Question: ${question}` : "Question: Which collections drove growth this month?",
    `Currency symbol: ${currency === "ZAR" ? "R" : currency}`,
    `Category revenue this month: ${metricsDigest || "none"}`,
  ].join("\n")

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      temperature: 0.4,
    }),
  })

  if (!res.ok) {
    throw new Error(`LLM responded ${res.status}: ${await res.text()}`)
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("LLM returned no content.")
  return content.trim()
}
