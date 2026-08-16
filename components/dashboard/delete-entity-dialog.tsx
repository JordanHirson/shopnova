"use client"

import { Trash2 } from "lucide-react"

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
import { useActionDialog } from "@/hooks/use-action-dialog"
import type { ActionState } from "@/lib/actions/crud"

interface DeleteEntityDialogProps {
  /** Capitalized singular entity name, e.g. "Product". */
  entityLabel: string
  /** Entity id and name, used for the hidden field and confirmation copy. */
  entity: { id: string; name: string }
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
}

/**
 * Confirmation dialog shared by the dashboard delete buttons.
 */
export function DeleteEntityDialog({
  entityLabel,
  entity,
  action,
}: DeleteEntityDialogProps) {
  const { open, setOpen, error, isPending, submit } = useActionDialog(action)

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
          <DialogTitle>{`Delete ${entityLabel}`}</DialogTitle>
          <DialogDescription>
            {`Are you sure you want to delete "${entity.name}"? This action cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        <form action={submit}>
          <input type="hidden" name="id" value={entity.id} />
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
