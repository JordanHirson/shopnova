import { TextLink } from "@/components/storefront/text-link"
import { cn } from "@/lib/utils"

interface PageIntroProps {
  title: string
  description?: string
  /** Optional back link rendered above the title. */
  backLink?: { href: string; label: string }
}

/**
 * Title block shared by the storefront listing pages.
 */
export function PageIntro({ title, description, backLink }: PageIntroProps) {
  return (
    <div className="mb-8">
      {backLink && (
        <TextLink href={backLink.href}>&larr; {backLink.label}</TextLink>
      )}
      <h1
        className={cn(
          "text-3xl font-bold tracking-tight text-foreground",
          backLink && "mt-4"
        )}
      >
        {title}
      </h1>
      {description && (
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
