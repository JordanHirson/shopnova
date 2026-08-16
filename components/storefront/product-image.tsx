import { ImageIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface ProductImageProps {
  image?: { url: string; alt: string | null }
  /** Fallback alt text when the image has none. */
  name: string
  className?: string
  imageClassName?: string
  iconClassName?: string
}

/**
 * Square product image with a placeholder icon when no image exists.
 */
export function ProductImage({
  image,
  name,
  className,
  imageClassName,
  iconClassName,
}: ProductImageProps) {
  return (
    <div
      className={cn(
        "relative aspect-square w-full overflow-hidden bg-muted",
        className
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.url}
          alt={image.alt ?? name}
          className={cn("h-full w-full object-cover", imageClassName)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageIcon
            className={cn("h-10 w-10 text-muted-foreground/40", iconClassName)}
          />
        </div>
      )}
    </div>
  )
}
