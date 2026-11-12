'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ShopNova Dashboard] Unhandled error:', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center p-6">
      <div className="w-full max-w-md rounded-lg border border-muted p-8">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We could not load this page. Please try again.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={() => reset()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
          <Link href="/dashboard">
            <a className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Return to dashboard
            </a>
          </Link>
        </div>
      </div>
    </div>
  )
}