import { Container } from "@/components/layout/container"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { cn } from "@/lib/utils"

interface PlaceholderPageProps {
  title: string
  description: string
  message: string
  containerClassName?: string
  emptyStateClassName?: string
}

/**
 * Page shell for sections that are not implemented yet:
 * a page header plus a single placeholder card.
 */
export function PlaceholderPage({
  title,
  description,
  message,
  containerClassName,
  emptyStateClassName,
}: PlaceholderPageProps) {
  return (
    <Container className={containerClassName}>
      <PageHeader title={title} description={description} />
      <EmptyState
        message={message}
        className={cn("mt-8", emptyStateClassName)}
      />
    </Container>
  )
}
