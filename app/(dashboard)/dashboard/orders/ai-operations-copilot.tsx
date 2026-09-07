"use client"

import { useState, useTransition } from "react"
import {
  Bot,
  CheckCircle2,
  Package,
  Ruler,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { aiFulfillOrderAction, type AiFulfillResult } from "./ai-fulfillment-actions"

/**
 * Serialised triage shape (mirrors `OrderTriage` in features/admin/ai-triage.ts).
 * Defined locally because the triage module is `server-only` and cannot be
 * imported into a client component.
 */
interface TriageProps {
  fraudRisk: { level: "Low" | "Medium" | "High"; score: number }
  stock: { status: "In Stock" | "Low Stock" | "Out of Stock" }
  physical: {
    totalWeightGrams: number
    lengthCm: number
    widthCm: number
    heightCm: number
    fullySpecified: boolean
  }
  recommendation: {
    label: string
    rate: number
    currency: string
    estimateHours: number
    simulated: boolean
  }
}

interface AiOperationsCopilotProps {
  orderNumber: string
  triage: TriageProps
  className?: string
}

function currencySymbol(currency: string): string {
  return currency === "ZAR" ? "R" : currency
}

function formatWeight(grams: number): string {
  const kg = grams / 1000
  return `${kg.toFixed(kg < 1 ? 2 : 1)} kg`
}

function riskTone(level: TriageProps["fraudRisk"]["level"]): string {
  switch (level) {
    case "Low":
      return "text-emerald-600 dark:text-emerald-400"
    case "Medium":
      return "text-amber-600 dark:text-amber-400"
    case "High":
      return "text-destructive"
  }
}

function stockTone(status: TriageProps["stock"]["status"]): string {
  switch (status) {
    case "In Stock":
      return "text-emerald-600 dark:text-emerald-400"
    case "Low Stock":
      return "text-amber-600 dark:text-amber-400"
    case "Out of Stock":
      return "text-destructive"
  }
}

export function AiOperationsCopilot({
  orderNumber,
  triage,
  className,
}: AiOperationsCopilotProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | undefined>()
  const [result, setResult] = useState<AiFulfillResult | null>(null)
  const [open, setOpen] = useState(false)

  function handleFulfill() {
    setError(undefined)
    startTransition(async () => {
      const res = await aiFulfillOrderAction(orderNumber)
      if (res.ok) {
        setResult(res)
        setOpen(true)
      } else {
        setError(res.error)
      }
    })
  }

  const { fraudRisk, stock, physical, recommendation } = triage
  const rateLabel = `${currencySymbol(recommendation.currency)} ${recommendation.rate.toFixed(2)}`

  return (
    <section
      aria-label="AI Operations Copilot"
      className={cn(
        "rounded-lg border border-primary/20 bg-primary/5 p-5",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              AI Operations Copilot
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </h2>
            <p className="text-xs text-muted-foreground">
              Automated order triage & courier booking
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={handleFulfill}
          disabled={isPending}
          className="gap-1.5"
        >
          <Truck className="h-4 w-4" />
          {isPending ? "Booking courier..." : "AI Fulfill & Book Courier"}
        </Button>
      </div>

      {/* Analysis grid */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <AnalysisTile
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Fraud Risk"
          value={`${fraudRisk.level} (Score: ${fraudRisk.score}/100)`}
          tone={riskTone(fraudRisk.level)}
        />
        <AnalysisTile
          icon={<Package className="h-4 w-4" />}
          label="Stock Verification"
          value={stock.status}
          tone={stockTone(stock.status)}
        />
        <AnalysisTile
          icon={<Ruler className="h-4 w-4" />}
          label="Weight & Dimensions"
          value={`Auto-calculated · ${formatWeight(physical.totalWeightGrams)} · ${physical.lengthCm}×${physical.widthCm}×${physical.heightCm} cm`}
        />
      </div>

      {/* Recommendation */}
      <div className="mt-3 flex items-start gap-2 rounded-md border border-primary/15 bg-background/60 p-3 text-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-foreground">
          <span className="font-medium">AI recommendation:</span> Cheapest
          courier: {recommendation.label} — {rateLabel}{" "}
          <span className="text-muted-foreground">
            | Estimated delivery: {recommendation.estimateHours}h
          </span>
          {recommendation.simulated ? (
            <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Simulated
            </span>
          ) : null}
        </p>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-destructive">{error}</p>
      ) : null}

      {/* Shipping label modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-primary" />
              Shipping label
            </DialogTitle>
            <DialogDescription>
              Courier booked and order advanced to PROCESSING.
            </DialogDescription>
          </DialogHeader>

          {result && result.ok ? (
            <div className="space-y-3">
              <div className="rounded-md border border-dashed bg-muted/40 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tracking number
                </p>
                <p className="mt-1 font-mono text-lg font-semibold text-foreground">
                  {result.trackingNumber}
                </p>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Courier</dt>
                  <dd className="font-medium text-foreground">
                    {result.courier}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Rate</dt>
                  <dd className="font-medium text-foreground">
                    {currencySymbol(result.currency)} {result.rate.toFixed(2)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Estimated delivery</dt>
                  <dd className="font-medium text-foreground">
                    {result.estimateHours}h
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Order status</dt>
                  <dd className="font-medium text-foreground">
                    {result.status}
                  </dd>
                </div>
              </dl>
              {result.simulated ? (
                <p className="text-xs text-muted-foreground">
                  Simulated booking for demo purposes. Connect Bob Go
                  (BOBGO_API_KEY) for live courier booking.
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </section>
  )
}

interface AnalysisTileProps {
  icon: React.ReactNode
  label: string
  value: string
  tone?: string
}

function AnalysisTile({ icon, label, value, tone }: AnalysisTileProps) {
  return (
    <div className="rounded-md border bg-background/60 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={cn("mt-1 text-sm font-medium text-foreground", tone)}>
        {value}
      </p>
    </div>
  )
}
