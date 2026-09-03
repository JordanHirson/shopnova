"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Pencil, Trash2, RotateCcw } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  productSchema,
  type ProductFormValues,
} from "@/lib/validations/product"
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  restoreProductAction,
  type ProductActionState,
} from "./actions"

interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  price: { toString(): string }
  compareAtPrice: { toString(): string } | null
  sku: string | null
  categoryId: string
  archived: boolean
  category: { id: string; name: string }
  images: { url: string }[]
  inventory: { quantity: number } | null
  weightGrams: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
}

interface Category {
  id: string
  name: string
}

interface ProductFormProps {
  product?: Product
  categories: Category[]
  onSuccess?: () => void
}

export function ProductForm({ product, categories, onSuccess }: ProductFormProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()
  const isEdit = Boolean(product)

  const action = isEdit ? updateProductAction : createProductAction

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      slug: product?.slug ?? "",
      description: product?.description ?? "",
      price: product ? product.price.toString() : "",
      compareAtPrice: product?.compareAtPrice ? product.compareAtPrice.toString() : "",
      sku: product?.sku ?? "",
      categoryId: product?.categoryId ?? "",
      imageUrl: product?.images?.[0]?.url ?? "",
      stock: product?.inventory ? String(product.inventory.quantity) : "",
      weightGrams: product?.weightGrams != null ? String(product.weightGrams) : "",
      lengthCm: product?.lengthCm != null ? String(product.lengthCm) : "",
      widthCm: product?.widthCm != null ? String(product.widthCm) : "",
      heightCm: product?.heightCm != null ? String(product.heightCm) : "",
    },
  })

  function handleSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const result = await action({} as ProductActionState, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        onSuccess?.()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={isEdit ? "ghost" : "default"} size={isEdit ? "icon-sm" : "default"}>
            {isEdit ? <Pencil /> : <Plus />}
            {!isEdit && "Add Product"}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product" : "Create Product"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the product details below."
              : "Add a new product to your catalog."}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit}>
          {isEdit && <input type="hidden" name="id" value={product!.id} />}
          <div className="grid gap-4">
            <Form {...form}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Wireless Headphones" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. wireless-headphones" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional description"
                        className="min-h-20"
                        {...field}
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
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 19.99" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="compareAtPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Compare-at Price</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Optional"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com/image.jpg"
                        {...field}
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
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Optional"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
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
                        {/* base-ui Select doesn't submit a native form value,
                            so mirror the selected id into FormData manually. */}
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
              </div>
              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g. 100"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-medium">
                  Shipping dimensions
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Optional. Used by live couriers (e.g. Bob Go) for accurate
                  shipping quotes. Leave blank to use the default parcel
                  estimate.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="weightGrams"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (grams)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="e.g. 750"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lengthCm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Length (cm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="e.g. 30"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="widthCm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Width (cm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="e.g. 20"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="heightCm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Height (cm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="e.g. 10"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </Form>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteProductButton({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()

  function handleDelete(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const result = await deleteProductAction({} as ProductActionState, formData)
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
          <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive">
            <Trash2 />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive Product</DialogTitle>
          <DialogDescription>
            {`Archive "${product.name}"? It will be hidden from the storefront and cart, but kept in the database so past orders stay intact. You can restore it later.`}
          </DialogDescription>
        </DialogHeader>
        <form action={handleDelete}>
          <input type="hidden" name="id" value={product.id} />
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RestoreProductButton({ product }: { product: Product }) {
  const [error, setError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()

  function handleRestore(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const result = await restoreProductAction({} as ProductActionState, formData)
      if (result.error) {
        setError(result.error)
      }
    })
  }

  return (
    <form action={handleRestore}>
      <input type="hidden" name="id" value={product.id} />
      <Button type="submit" variant="ghost" size="icon-sm" disabled={isPending}>
        {isPending ? "..." : <RotateCcw />}
      </Button>
      {error && <p className="sr-only text-sm text-destructive">{error}</p>}
    </form>
  )
}