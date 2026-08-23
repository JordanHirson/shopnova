"use client"

import { useState, useTransition } from "react"
import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  updateInventoryAction,
  type InventoryActionState,
} from "./actions"

interface InventoryRow {
  productId: string
  productName: string
  quantity: number
  lowStockThreshold: number
}

export function InventoryForm({ row }: { row: InventoryRow }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const result = await updateInventoryAction({} as InventoryActionState, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm">
            <Pencil />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Update inventory</DialogTitle>
          <DialogDescription>
            {`Adjust stock and the low-stock threshold for "${row.productName}". Leave a field blank to keep its current value.`}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit}>
          <input type="hidden" name="productId" value={row.productId} />
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantity on hand</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min={0}
                step={1}
                placeholder={String(row.quantity)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lowStockThreshold">Low-stock threshold</Label>
              <Input
                id="lowStockThreshold"
                name="lowStockThreshold"
                type="number"
                min={0}
                step={1}
                placeholder={String(row.lowStockThreshold)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
