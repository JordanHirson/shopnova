import { z } from "zod"

export const checkoutSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(255, "First name must be 255 characters or less"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(255, "Last name must be 255 characters or less"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .max(255, "Email must be 255 characters or less"),
  phone: z
    .string()
    .min(1, "Phone is required")
    .max(50, "Phone must be 50 characters or less"),
  shippingAddress: z
    .string()
    .min(1, "Shipping address is required")
    .max(255, "Shipping address must be 255 characters or less"),
  city: z
    .string()
    .min(1, "City is required")
    .max(255, "City must be 255 characters or less"),
  province: z
    .string()
    .min(1, "Province/state is required")
    .max(255, "Province/state must be 255 characters or less"),
  postalCode: z
    .string()
    .min(1, "Postal code is required")
    .max(20, "Postal code must be 20 characters or less"),
  country: z
    .string()
    .min(1, "Country is required")
    .max(255, "Country must be 255 characters or less"),
})

export type CheckoutFormValues = z.infer<typeof checkoutSchema>