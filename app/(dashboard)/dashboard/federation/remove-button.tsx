"use client"

import { useState, useTransition } from "react"
import { Trash2, Loader2 } from "lucide-react"

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
  deleteFederationLinkAction,
  type FederationActionState,
} from "./actions"

interface RemoveFederationButtonProps {
  linkId: string
  name: string
  productCount: number
}

export function RemoveFederationButton({
  linkId,
  name,
  productCount,
}: RemoveFederationButtonProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()

  function handleDelete(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const result = await deleteFederationLinkAction(
        {} as FederationActionState,
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
            aria-label={`Remove ${name} federation source`}
          >
            <Trash2 />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove federation source</DialogTitle>
          <DialogDescription>
            {`Remove "${name}" from your linked sources? All ${productCount}
            imported product(s) will be permanently deleted. Products that
            appear on past orders will be archived instead so order history
            stays intact. This action cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        <form action={handleDelete}>
          <input type="hidden" name="linkId" value={linkId} />
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
