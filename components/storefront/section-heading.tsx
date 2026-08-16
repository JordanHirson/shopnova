import { TextLink } from "@/components/storefront/text-link"

interface SectionHeadingProps {
  title: string
  /** Optional "view all" style link shown on the right. */
  link?: { href: string; label: string }
}

/**
 * Section title row used by the storefront home page sections.
 */
export function SectionHeading({ title, link }: SectionHeadingProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {link && <TextLink href={link.href}>{link.label}</TextLink>}
    </div>
  )
}
