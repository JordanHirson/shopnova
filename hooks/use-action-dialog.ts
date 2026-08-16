"use client"

import { useState, useTransition } from "react"
import type { ActionState } from "@/lib/actions/crud"

type FormAction = (
  prevState: ActionState,
  formData: FormData
) => Promise<ActionState>

/**
 * Drives a dialog that submits a form to a server action:
 * tracks open state, pending state, and the returned error,
 * closing the dialog on success.
 */
export function useActionDialog(action: FormAction, onSuccess?: () => void) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()

  function submit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const result = await action({}, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        onSuccess?.()
      }
    })
  }

  return { open, setOpen, error, isPending, submit }
}
