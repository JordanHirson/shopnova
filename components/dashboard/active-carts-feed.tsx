"use client"

import * as React from "react"
import { useTransition } from "react"
import { Clock, Mail, MailCheck, ShoppingCart, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  triggerRecoveryEmailAction,
} from "@/app/(dashboard)/dashboard/abandonment-actions"
import type { AbandonedCart, RecoveryEmailPreview } from "@/lib/db"

/**
 * ShopNova - "Active Carts & Recovery" feed (Demo Step 7).
 *
 * Shows abandoned carts with elapsed inactivity time and a "Trigger Recovery
 * Email" action. Triggering pops a live preview of the exact email fired
 * (personalized subject, abandoned items, 10% discount recovery link) and
 * surfaces a real-time toast: "Abandonment email dispatched to ...".
 *
 * The carts are server-fetched (deterministic simulation grounded in real
 * customers/products — see lib/db/abandonment.ts) and passed in as props.
 */

interface ActiveCartsFeedProps {
  carts: AbandonedCart[]
}

function currencySymbol(currency: string): string {
  return currency === "ZAR" ? "R" : currency
}

function formatTotal(value: number, currency: string): string {
  return `${currencySymbol(currency)} ${value.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`
}

function formatInactivity(minutes: number): string {
  if (minutes < 60) return `Inactive for ${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `Inactive for ${h}h ${m}m`
}

export function ActiveCartsFeed({ carts }: ActiveCartsFeedProps) {
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = React.useState<RecoveryEmailPreview | null>(null)
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [toast, setToast] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | undefined>()
  const [activeCartId, setActiveCartId] = React.useState<string | null>(null)

  // Lightweight auto-dismissing toast (no new dependency).
  React.useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  function handleTrigger(cart: AbandonedCart) {
    setError(undefined)
    setActiveCartId(cart.id)
    startTransition(async () => {
      const res = await triggerRecoveryEmailAction(cart.id)
      if (res.ok) {
        setPreview(res.email)
        setPreviewOpen(true)
        setToast(`Abandonment email dispatched to ${res.email.to}`)
      } else {
        setError(res.error)
      }
      setActiveCartId(null)
    })
  }

  if (carts.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        <ShoppingCart className="mx-auto h-6 w-6 opacity-50" />
        <p className="mt-2 text-sm">No abandoned carts right now.</p>
      </div>
    )
  }

  return (
    <div>
      <ul className="divide-y rounded-lg border">
        {carts.map((cart) => {
          const isActive = activeCartId === cart.id
          return (
            <li
              key={cart.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Cart #{cart.cartNumber} · {cart.customerName}{" "}
                  <span className="text-muted-foreground">
                    ({formatTotal(cart.total, cart.currency)})
                  </span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {formatInactivity(cart.abandonedMinutesAgo)}
                  <span aria-hidden>·</span>
                  {cart.items.length} item{cart.items.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleTrigger(cart)}
                disabled={isPending}
                className="gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" />
                {isActive ? "Dispatching..." : "Trigger Recovery Email"}
              </Button>
            </li>
          )
        })}
      </ul>

      {error ? (
        <p className="mt-3 text-sm text-destructive">{error}</p>
      ) : null}

      <RecoveryEmailDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={preview}
      />

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

function RecoveryEmailDialog({
  open,
  onOpenChange,
  preview,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: RecoveryEmailPreview | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <MailCheck className="h-4 w-4 text-primary" />
            Recovery email dispatched
          </DialogTitle>
          <DialogDescription>
            Live preview of the exact email sent to the customer.
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="space-y-3 text-sm">
            <dl className="space-y-1.5 rounded-md border bg-muted/40 p-3">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">To</dt>
                <dd className="font-medium text-foreground">{preview.to}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Subject</dt>
                <dd className="text-right font-medium text-foreground">
                  {preview.subject}
                </dd>
              </div>
            </dl>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Abandoned items
              </p>
              <ul className="mt-2 space-y-1.5">
                {preview.items.map((item, i) => (
                  <li
                    key={`${item.name}-${i}`}
                    className="flex items-center justify-between rounded-md border bg-background px-3 py-2"
                  >
                    <span className="text-foreground">
                      {item.name}{" "}
                      <span className="text-muted-foreground">×{item.quantity}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {formatTotal(item.price, preview.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <dl className="space-y-1.5 rounded-md border bg-muted/40 p-3">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="text-foreground">
                  {formatTotal(preview.subtotal, preview.currency)}
                </dd>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <dt>Recovery discount ({preview.discountPct}%)</dt>
                <dd>-{formatTotal(preview.discountAmount, preview.currency)}</dd>
              </div>
              <div className="flex justify-between border-t pt-1.5 font-medium">
                <dt className="text-foreground">New total</dt>
                <dd className="text-foreground">
                  {formatTotal(preview.total, preview.currency)}
                </dd>
              </div>
            </dl>

            <div className="rounded-md border border-dashed bg-primary/5 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Recovery link
              </p>
              <p className="mt-1 break-all font-mono text-xs text-primary">
                {preview.recoveryLink}
              </p>
            </div>
          </div>
        ) : null}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}

function Toast({
  message,
  onDismiss,
}: {
  message: string | null
  onDismiss: () => void
}) {
  if (!message) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-lg border bg-popover p-3 pr-4 text-popover-foreground shadow-lg",
        "animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
      )}
    >
      <MailCheck className="h-4 w-4 shrink-0 text-primary" />
      <span className="text-sm font-medium">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="ml-1 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
