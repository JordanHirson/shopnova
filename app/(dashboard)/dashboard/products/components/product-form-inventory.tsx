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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Category } from "@/lib/types/product"
import type { ProductFormValues } from "@/lib/validations/product"

export interface ProductFormInventoryProps {
  control: Control<ProductFormValues>
  categories: Category[]
}

export function ProductFormInventory({
  control,
  categories,
}: ProductFormInventoryProps) {
  return (
    <>
      <FormField
        control={control}
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
        control={control}
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
              {/* base-ui Select doesn't submit a native form value,
                  so mirror the selected id into FormData manually. */}
              <input type="hidden" name="categoryId" value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="stock"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Stock</FormLabel>
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
    </>
  )
}
