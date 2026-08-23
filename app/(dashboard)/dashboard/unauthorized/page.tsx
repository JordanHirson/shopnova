import Link from "next/link"
import { ShieldAlert } from "lucide-react"

import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default function UnauthorizedPage() {
  return (
    <Container>
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
          Administrator access required
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Your account does not have permission to access the ShopNova admin
          area. If you believe this is an error, contact the store owner to
          grant your account the admin role.
        </p>
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "mt-6 gap-1.5"
          )}
        >
          Back to storefront
        </Link>
      </div>
    </Container>
  )
}
