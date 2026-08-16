import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formats a price (Prisma Decimal or string) for display. */
export function formatPrice(price: { toString(): string }) {
  return `$${price.toString()}`
}

/** Returns `count` followed by the singular or plural form of `noun`. */
export function pluralize(count: number, noun: string) {
  return `${count} ${count === 1 ? noun : `${noun}s`}`
}
