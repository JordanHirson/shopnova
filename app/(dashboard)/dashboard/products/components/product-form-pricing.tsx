"use client"

import { type Control } from "react-hook-form"

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import type { ProductFormValues } from "@/lib/validations/product"

export interface ProductFormPricingProps {
  control: Control<ProductFormValues>
}

export function ProductFormPricing({ control }: ProductFormPricingProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={control}
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
        control={control}
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
  )
}
