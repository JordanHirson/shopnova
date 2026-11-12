"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Pencil } from "lucide-react"

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
import { Form } from "@/components/ui/form"
import { ProductFormAiAutofill } from "./components/product-form-ai-autofill"
import { ProductFormBasics } from "./components/product-form-basics"
import { ProductFormInventory } from "./components/product-form-inventory"
import { ProductFormPricing } from "./components/product-form-pricing"
import { ProductFormShippingDimensions } from "./components/product-form-shipping-dimensions"
import {
  createProductAction,
  updateProductAction,
  type ProductActionState,
} from "./actions"
import { type Category, type Product } from "@/lib/types/product"
import {
  productSchema,
  type ProductFormValues,
} from "@/lib/validations/product"

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
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product" : "Create Product"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the product details below." : "Add a new product to your catalog."}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isEdit && <input type="hidden" name="id" value={product!.id} />}
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto pr-1">
            <Form {...form}>
              <ProductFormBasics control={form.control} />
              <ProductFormPricing control={form.control} />
              <ProductFormAiAutofill
                control={form.control}
                form={form}
                categories={categories}
                isPending={isPending}
              />
              <ProductFormInventory control={form.control} categories={categories} />
              <ProductFormShippingDimensions control={form.control} />
            </Form>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="shrink-0">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
