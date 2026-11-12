"use client"

import { useState } from "react"
import { useTransition } from "react"
import { RotateCcw, Trash2, XCircle } from "lucide-react"

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
import {
  deleteProductAction,
  permanentlyDeleteProductAction,
  restoreProductAction,
  type ProductActionState,
} from "./actions"
import { type Product } from "@/lib/types/product"

export function DeleteProductButton({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()

  function handleDelete(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const result = await deleteProductAction({} as ProductActionState, formData)
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
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive Product</DialogTitle>
          <DialogDescription>
            {`Archive "${product.name}"? It will be hidden from the storefront and cart, but kept in the database so past orders stay intact. You can restore it later.`}
          </DialogDescription>
        </DialogHeader>
        <form action={handleDelete}>
          <input type="hidden" name="id" value={product.id} />
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RestoreProductButton({ product }: { product: Product }) {
  const [error, setError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()

  function handleRestore(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const result = await restoreProductAction({} as ProductActionState, formData)
      if (result.error) {
        setError(result.error)
      }
    })
  }

  return (
    <form action={handleRestore}>
      <input type="hidden" name="id" value={product.id} />
      <Button type="submit" variant="ghost" size="icon-sm" disabled={isPending}>
        {isPending ? "..." : <RotateCcw />}
      </Button>
      {error && <p className="sr-only text-sm text-destructive">{error}</p>}
    </form>
  )
}

export function PermanentlyDeleteProductButton({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()

  function handleDelete(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const result = await permanentlyDeleteProductAction(
        {} as ProductActionState,
        formData
      )
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
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive"
            aria-label={`Permanently delete ${product.name}`}
          >
            <XCircle />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permanently delete product</DialogTitle>
          <DialogDescription>
            {`Permanently delete "${product.name}"? This removes it entirely from your database — including images and inventory — and cannot be undone. Products that appear on past orders cannot be permanently deleted; archive them instead.`}
          </DialogDescription>
        </DialogHeader>
        <form action={handleDelete}>
          <input type="hidden" name="id" value={product.id} />
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
