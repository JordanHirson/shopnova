import Link from "next/link"

import { cn } from "@/lib/utils"

type TextLinkProps = React.ComponentProps<typeof Link>

/**
 * Inline accent link used for storefront navigation ("View all", back links).
 */
export function TextLink({ className, ...props }: TextLinkProps) {
  return (
    <Link
      className={cn(
        "text-sm font-medium text-primary hover:underline",
        className
      )}
      {...props}
    />
  )
}
