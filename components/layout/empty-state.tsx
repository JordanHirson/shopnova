import { cn } from "@/lib/utils"

interface EmptyStateProps {
  message: string
  className?: string
}

/**
 * Bordered placeholder card used for empty lists and upcoming pages.
 */
export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-12 text-center text-muted-foreground",
        className
      )}
    >
      <p>{message}</p>
    </div>
  )
}
