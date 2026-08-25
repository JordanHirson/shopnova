"use client"

import Link from "next/link"
import { Menu } from "lucide-react"
import { useState } from "react"

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/categories", label: "Categories" },
] as const

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="relative md:hidden"
    >
      <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open navigation</span>
      </summary>
      <nav className="fixed inset-x-4 top-16 z-50 mx-auto flex max-w-7xl flex-col gap-1 rounded-lg border bg-background p-2 text-sm font-medium shadow-md">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </details>
  )
}
