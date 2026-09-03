"use client"

import { useState, useTransition } from "react"
import { RefreshCw, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  runFederationSyncAction,
  type FederationActionState,
} from "./actions"

interface SyncButtonProps {
  linkId: string
}

export function SyncButton({ linkId }: SyncButtonProps) {
  const [error, setError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()

  function handleSync(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const result = await runFederationSyncAction(
        {} as FederationActionState,
        formData
      )
      if (result.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={handleSync}>
        <input type="hidden" name="linkId" value={linkId} />
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw />
              Sync Now
            </>
          )}
        </Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
