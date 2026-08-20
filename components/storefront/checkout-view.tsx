/**
 * ShopNova - Checkout view (client component).
 *
 * Collects contact + shipping details, shows an authoritative order
 * summary (re-read from PostgreSQL), and starts the hosted-payment flow
 * through a server action. The client never sends prices or stock, and
 * never receives or stores card data — the shopper is redirected to the
 * gateway's hosted payment UI.
 */
"use client"

import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useUser } from "@clerk/nextjs"
import { ImageIcon, Loader2 } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useCart } from "@/features/cart/cart-context"
import {
  getCheckoutSummaryAction,
  type CheckoutSummary,
} from "@/features/checkout/actions"
import { startCheckoutPaymentAction } from "@/features/payment/actions"
import {
  checkoutSchema,
  type CheckoutFormValues,
} from "@/lib/validations/checkout"

export function CheckoutView() {
  const { cart, loading: cartLoading } = useCart()
  const { user, isLoaded: clerkLoaded } = useUser()
  const [summary, setSummary] = useState<CheckoutSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      shippingAddress: "",
      city: "",
      province: "",
      postalCode: "",
      country: "",
    },
  })

  // Load the authoritative checkout summary from the server.
  useEffect(() => {
    let active = true

    async function load() {
      try {
        const data = await getCheckoutSummaryAction()
        if (active) {
          setSummary(data)
          setSummaryError(null)
        }
      } catch (err) {
        if (active) {
          setSummaryError(
            err instanceof Error ? err.message : "Failed to load checkout."
          )
        }
      } finally {
        if (active) {
          setSummaryLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  // Prefill contact info from Clerk when available.
  useEffect(() => {
    if (!clerkLoaded || !user) return

    const email = user.primaryEmailAddress?.emailAddress ?? ""
    const firstName = user.firstName ?? ""
    const lastName = user.lastName ?? ""

    form.setValue("firstName", firstName || form.getValues("firstName"))
    form.setValue("lastName", lastName || form.getValues("lastName"))
    form.setValue("email", email || form.getValues("email"))
  }, [clerkLoaded, user, form])

  function handleSubmit(values: CheckoutFormValues) {
    setSubmitError(null)
    startTransition(async () => {
      const result = await startCheckoutPaymentAction(values)
      if (result.error) {
        setSubmitError(result.error)
        return
      }
      if (result.redirectUrl) {
        // External hosted payment page (Stripe/PayFast) or the local
        // mock payment page (Test gateway). Use a full page navigation
        // so the shopper leaves ShopNova for the gateway and returns.
        window.location.href = result.redirectUrl
      }
    })
  }

  if (cartLoading || summaryLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (summaryError) {
    return <p className="text-sm text-destructive">{summaryError}</p>
  }

  if (cart.items.length === 0 || !summary) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border py-16 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Your cart is empty
        </h2>
        <p className="text-sm text-muted-foreground">
          Add items to your cart before checking out.
        </p>
        <Link href="/products" className={buttonVariants({ size: "lg" })}>
          Browse Products
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* Checkout form */}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-8"
        >
          {/* Contact information */}
          <section className="rounded-lg border p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Contact Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="jane@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+27 12 345 6789" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* Shipping address */}
          <section className="rounded-lg border p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Shipping Address
            </h2>
            <div className="grid gap-4">
              <FormField
                control={form.control}
                name="shippingAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main Street" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Cape Town" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Province / State</FormLabel>
                      <FormControl>
                        <Input placeholder="Western Cape" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal code</FormLabel>
                      <FormControl>
                        <Input placeholder="8001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="South Africa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </section>

          {submitError && (
            <p className="text-sm font-medium text-destructive">{submitError}</p>
          )}
        </form>
      </Form>

      {/* Order summary */}
      <div className="h-fit rounded-lg border p-6 lg:sticky lg:top-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Order Summary
        </h2>
        <div className="flex flex-col gap-3 border-b pb-4">
          {summary.items.map((item) => (
            <div key={item.productId} className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col">
                <Link
                  href={`/products/${item.slug}`}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  {item.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  Qty {item.quantity} &times; ${item.unitPrice.toFixed(2)}
                </span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                ${item.lineTotal.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="font-medium text-foreground">
              ${summary.subtotal.toFixed(2)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd className="font-medium text-foreground">
              {summary.shipping === 0
                ? "Free"
                : `$${summary.shipping.toFixed(2)}`}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">VAT (15%)</dt>
            <dd className="font-medium text-foreground">
              ${summary.vat.toFixed(2)}
            </dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-base">
            <dt className="font-semibold text-foreground">Total</dt>
            <dd className="font-semibold text-foreground">
              ${summary.total.toFixed(2)}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-col gap-3">
          <Button
            size="lg"
            type="submit"
            disabled={isPending}
            onClick={form.handleSubmit(handleSubmit)}
          >
            {isPending ? <Loader2 className="animate-spin" /> : null}
            {isPending ? "Redirecting to payment..." : "Continue to Payment"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            You will be redirected to our secure payment provider
            (Stripe or PayFast). Card details are never handled by
            ShopNova.
          </p>
          <Link
            href="/cart"
            className="block text-center text-sm font-medium text-primary hover:underline"
          >
            Back to Cart
          </Link>
        </div>
      </div>
    </div>
  )
}