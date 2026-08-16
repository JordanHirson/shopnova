"use client"

import { useEffect } from "react"
import { Container } from "@/components/layout/container"
import { Button } from "@/components/ui/button"

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Unhandled application error:", error)
  }, [error])

  return (
    <div className="py-16">
      <Container>
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border p-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Something went wrong
          </h1>
          <p className="text-muted-foreground">
            We couldn&apos;t load this page. Please try again.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground">
              Reference: {error.digest}
            </p>
          )}
          <Button onClick={reset}>Try again</Button>
        </div>
      </Container>
    </div>
  )
}
