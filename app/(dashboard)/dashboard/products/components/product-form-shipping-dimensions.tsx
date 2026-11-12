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

export interface ProductFormShippingDimensionsProps {
  control: Control<ProductFormValues>
}

export function ProductFormShippingDimensions({
  control,
}: ProductFormShippingDimensionsProps) {
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-sm font-medium">Shipping dimensions</p>
      <p className="mb-3 text-xs text-muted-foreground">
        Optional. Used by live couriers (e.g. Bob Go) for accurate shipping
        quotes. Leave blank to use the default parcel estimate.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
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
          control={control}
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
          control={control}
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
          control={control}
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
  )
}
