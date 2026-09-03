"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  federationLinkSchema,
  type FederationLinkFormValues,
} from "@/lib/validations/federation"
import {
  createFederationLinkAction,
  type FederationActionState,
} from "./actions"

interface Category {
  id: string
  name: string
  slug: string
}

interface FederationFormProps {
  categories: Category[]
}

const SOURCES = [
  { value: "shopify", label: "Shopify (Storefront API)" },
  { value: "aliexpress", label: "AliExpress (via Cloudways/AliDropship)" },
  { value: "amazon", label: "Amazon SP-API" },
  { value: "takealot", label: "Takealot Marketplace API" },
  { value: "woocommerce", label: "WooCommerce REST API" },
  { value: "csv", label: "CSV / Google Sheets" },
]

export function FederationForm({ categories }: FederationFormProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()
  const [isConnecting, setIsConnecting] = useState(false)

  const form = useForm<FederationLinkFormValues>({
    resolver: zodResolver(federationLinkSchema),
    defaultValues: {
      name: "",
      source: "shopify",
      categoryId: "",
      markupType: "percentage",
      markupValue: 25,
      syncIntervalMinutes: 30,
    },
  })

  /**
   * Simulates the GUIDEBOOK OAuth step ("OAuth into the upstream Shopify
   * store; ShopNova receives a token") with a short delay so the demo
   * audience can see the "connecting" state before the form submits.
   */
  async function handleConnect() {
    setError(undefined)
    setIsConnecting(true)
    await new Promise((resolve) => setTimeout(resolve, 700))
    setIsConnecting(false)
  }

  function handleSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      await handleConnect()
      const result = await createFederationLinkAction(
        {} as FederationActionState,
        formData
      )
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus />
            Add Federation Source
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link an external store</DialogTitle>
          <DialogDescription>
            Connect a Shopify store to import and resell its products with
            automatic sync and markup.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          <Form {...form}>
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a source" />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCES.map((source) => (
                          <SelectItem key={source.value} value={source.value}>
                            {source.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input
                      type="hidden"
                      name="source"
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Upstream store name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Acme Shopify Outlet" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    A friendly label for the connected store.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Import into category</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input
                      type="hidden"
                      name="categoryId"
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="markupType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Markup type</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a markup type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage (%)</SelectItem>
                          <SelectItem value="fixed">Fixed amount (R)</SelectItem>
                        </SelectContent>
                      </Select>
                      <input
                        type="hidden"
                        name="markupType"
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="markupValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Markup value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 25"
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="syncIntervalMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sync interval (minutes)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="e.g. 30"
                      {...field}
                      onChange={(e) =>
                        field.onChange(Number(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Form>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  {isConnecting ? "Connecting to Shopify..." : "Linking..."}
                </>
              ) : (
                "Connect & Link"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
