import { z } from "zod"

const MONEY_REGEX = /^\d+(\.\d{1,2})?$/
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const nameField = z
  .string()
  .min(1, "Name is required")
  .max(255, "Name must be 255 characters or less")

export const slugField = z
  .string()
  .min(1, "Slug is required")
  .max(255, "Slug must be 255 characters or less")
  .regex(SLUG_REGEX, "Slug must be lowercase letters, numbers, and hyphens")

export const descriptionField = z
  .string()
  .max(5000, "Description must be 5000 characters or less")
  .optional()
  .nullable()

export function priceField(label: string) {
  return z
    .string()
    .min(1, `${label} is required`)
    .regex(MONEY_REGEX, `${label} must be a valid amount (e.g. 19.99)`)
}

export function optionalPriceField(label: string) {
  return z
    .string()
    .regex(MONEY_REGEX, `${label} must be a valid amount (e.g. 19.99)`)
    .optional()
    .nullable()
    .or(z.literal(""))
}
