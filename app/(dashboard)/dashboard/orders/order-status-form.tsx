"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ADMIN_ORDER_STATUSES,
  type AdminOrderStatus,
} from "@/features/admin/admin-logic"
import {
  updateOrderStatusAction,
  type OrderStatusActionState,
} from "./actions"

interface OrderStatusFormProps {
  orderNumber: string
  currentStatus: string
}

export function OrderStatusForm({ orderNumber, currentStatus }: OrderStatusFormProps) {
  const [status, setStatus] = useState<AdminOrderStatus | "">(
    (ADMIN_ORDER_STATUSES as readonly string[]).includes(currentStatus)
      ? (currentStatus as AdminOrderStatus)
      : ""
  )
  const [error, setError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(undefined)
    if (!status) {
      setError("Select a status.")
      return
    }
    formData.set("status", status)
    startTransition(async () => {
      const result = await updateOrderStatusAction({} as OrderStatusActionState, formData)
      if (result.error) {
        setError(result.error)
      }
    })
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <input type="hidden" name="status" value={status} />
      <Select
        value={status}
        onValueChange={(value) => setStatus(value as AdminOrderStatus)}
      >
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent>
          {ADMIN_ORDER_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={isPending || !status}>
        {isPending ? "Saving..." : "Update status"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}
