"use client"

import { Pencil, Plus } from "lucide-react"

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

interface EntityFormDialogProps {
  /** Capitalized singular entity name, e.g. "Category". */
  entityLabel: string
  isEdit: boolean
  /** Description shown when creating a new entity. */
  createDescription: string
  /** Id of the edited entity, submitted as a hidden field. */
  entityId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (formData: FormData) => void
  error?: string
  isPending: boolean
  contentClassName?: string
  /** Form fields rendered inside the dialog. */
  children: React.ReactNode
}

/**
 * Create/edit dialog shell shared by the dashboard entity forms:
 * trigger button, header copy, hidden id, error message and submit button.
 */
export function EntityFormDialog({
  entityLabel,
  isEdit,
  createDescription,
  entityId,
  open,
  onOpenChange,
  onSubmit,
  error,
  isPending,
  contentClassName,
  children,
}: EntityFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant={isEdit ? "ghost" : "default"}
            size={isEdit ? "icon-sm" : "default"}
          >
            {isEdit ? <Pencil /> : <Plus />}
            {!isEdit && `Add ${entityLabel}`}
          </Button>
        }
      />
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit ${entityLabel}` : `Create ${entityLabel}`}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Update the ${entityLabel.toLowerCase()} details below.`
              : createDescription}
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit}>
          {isEdit && entityId && (
            <input type="hidden" name="id" value={entityId} />
          )}
          <div className="grid gap-4">
            {children}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving..."
                : isEdit
                  ? "Save Changes"
                  : `Create ${entityLabel}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
