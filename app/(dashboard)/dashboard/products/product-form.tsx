"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { EntityFormDialog } from "@/components/dashboard/entity-form-dialog"
import { TextField, TextareaField } from "@/components/dashboard/form-fields"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useActionDialog } from "@/hooks/use-action-dialog"
import {
  productSchema,
  type ProductFormValues,
} from "@/lib/validations/product"
import { createProductAction, updateProductAction } from "./actions"

interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  price: { toString(): string }
  compareAtPrice: { toString(): string } | null
  sku: string | null
  categoryId: string
  category: { id: string; name: string }
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
  const isEdit = Boolean(product)
  const { open, setOpen, error, isPending, submit } = useActionDialog(
    isEdit ? updateProductAction : createProductAction,
    onSuccess
  )

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
    },
  })

  return (
    <EntityFormDialog
      entityLabel="Product"
      isEdit={isEdit}
      createDescription="Add a new product to your catalog."
      entityId={product?.id}
      open={open}
      onOpenChange={setOpen}
      onSubmit={submit}
      error={error}
      isPending={isPending}
      contentClassName="sm:max-w-lg"
    >
      <Form {...form}>
        <TextField
          control={form.control}
          name="name"
          label="Name"
          placeholder="e.g. Wireless Headphones"
        />
        <TextField
          control={form.control}
          name="slug"
          label="Slug"
          placeholder="e.g. wireless-headphones"
        />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          placeholder="Optional description"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="price"
            label="Price"
            placeholder="e.g. 19.99"
          />
          <TextField
            control={form.control}
            name="compareAtPrice"
            label="Compare-at Price"
            placeholder="Optional"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="sku"
            label="SKU"
            placeholder="Optional"
          />
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
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
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Form>
    </EntityFormDialog>
  )
}
