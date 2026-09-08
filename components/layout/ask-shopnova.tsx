"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Bot, Send, Sparkles, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * ShopNova - "Ask ShopNova" conversational insights slide-over (Demo Step 6).
 *
 * A top-bar button opens a right-hand slide-over panel with suggested
 * question chips and a free-text input. Submitting calls the
 * `/api/ai/insights` route and renders the natural-language answer plus
 * supporting mini metric bars (category revenue + month-over-month growth).
 *
 * Built on the existing Base UI Dialog primitive (no new dependency) — the
 * popup is styled as a right-side slide-over instead of a centered modal.
 */

interface CategoryMetric {
  category: string
  revenue: number
  growthPct: number | null
}

interface InsightsResponse {
  answer: string
  metrics: CategoryMetric[]
  currency: string
  periodLabel: string
  totalRevenue: number
  simulated: boolean
}

const SUGGESTED_QUESTIONS = [
  "Which collections drove growth this month?",
  "What is our best-selling category?",
]

function currencySymbol(currency: string): string {
  return currency === "ZAR" ? "R" : currency
}

function formatRevenue(value: number, currency: string): string {
  const symbol = currencySymbol(currency)
  return `${symbol}${value.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`
}

export function AskShopNova() {
  const [open, setOpen] = React.useState(false)
  const [question, setQuestion] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | undefined>()
  const [result, setResult] = React.useState<InsightsResponse | null>(null)

  async function ask(q: string) {
    const trimmed = q.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError(undefined)
    try {
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Request failed (${res.status}).`)
      }
      const data = (await res.json()) as InsightsResponse
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  function handleChip(q: string) {
    setQuestion(q)
    void ask(q)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={
          <Button variant="secondary" size="sm" className="gap-1.5" />
        }
      >
        <Sparkles className="h-4 w-4 text-primary" />
        Ask ShopNova
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 isolate z-50 bg-black/10 duration-200 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed top-0 right-0 z-50 flex h-screen w-full max-w-md flex-col gap-0 border-l bg-popover p-0 text-popover-foreground shadow-xl outline-none duration-200 data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </span>
              <div>
                <DialogPrimitive.Title className="text-sm font-semibold leading-none text-foreground">
                  Ask ShopNova
                </DialogPrimitive.Title>
                <p className="mt-1 text-xs text-muted-foreground">
                  Conversational sales insights
                </p>
              </div>
            </div>
            <DialogPrimitive.Close
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Close" />
              }
            >
              <XIcon />
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Suggested chips */}
            <p className="text-xs font-medium text-muted-foreground">
              Suggested questions
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleChip(q)}
                  disabled={loading}
                  className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-primary/10 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Answer */}
            <div className="mt-5">
              {loading ? (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                  Analyzing your store data...
                </div>
              ) : error ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {error}
                </p>
              ) : result ? (
                <InsightsResult result={result} />
              ) : (
                <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                  Ask a question or pick a suggestion above to see AI-powered
                  insights about your store&apos;s performance.
                </p>
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="border-t p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void ask(question)
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about your store..."
                className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Button
                type="submit"
                size="icon"
                disabled={loading || !question.trim()}
                aria-label="Send question"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function InsightsResult({ result }: { result: InsightsResponse }) {
  const maxRevenue = Math.max(1, ...result.metrics.map((m) => m.revenue))

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm leading-relaxed text-foreground">{result.answer}</p>
        {result.simulated ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Generated locally for the demo. Set OPENAI_API_KEY for LLM-phrased
            answers.
          </p>
        ) : null}
      </div>

      {result.metrics.length > 0 ? (
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Revenue by collection · {result.periodLabel}
            </p>
            <p className="text-xs font-medium text-foreground">
              {formatRevenue(result.totalRevenue, result.currency)} total
            </p>
          </div>
          <ul className="mt-3 space-y-3">
            {result.metrics.map((m) => (
              <li key={m.category}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{m.category}</span>
                  <span className="text-muted-foreground">
                    {formatRevenue(m.revenue, result.currency)}
                    {m.growthPct !== null ? (
                      <span
                        className={cn(
                          "ml-2 font-medium",
                          m.growthPct >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-destructive"
                        )}
                      >
                        {m.growthPct >= 0 ? "+" : ""}
                        {m.growthPct}%
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(m.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
