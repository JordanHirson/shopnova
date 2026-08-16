import { EmptyState } from "@/components/layout/empty-state"

interface TableCardProps {
  isEmpty: boolean
  emptyMessage: string
  children: React.ReactNode
}

/**
 * Bordered card wrapping a dashboard table, falling back to an empty state.
 */
export function TableCard({ isEmpty, emptyMessage, children }: TableCardProps) {
  if (isEmpty) {
    return <EmptyState className="mt-8" message={emptyMessage} />
  }

  return <div className="mt-8 rounded-lg border">{children}</div>
}
