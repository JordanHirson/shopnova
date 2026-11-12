"use client"

import { type Control, type UseFormReturn } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Loader2, Sparkles } from "lucide-react"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useAiAutofill } from "@/lib/hooks/use-ai-autofill"
import type { Category } from "@/lib/types/product"
import type { ProductFormValues } from "@/lib/validations/product"

export interface ProductFormAiAutofillProps {
  control: Control<ProductFormValues>
  form: UseFormReturn<ProductFormValues>
  categories: Category[]
  isPending: boolean
}

export function ProductFormAiAutofill({
  control,
  form,
  categories,
  isPending,
}: ProductFormAiAutofillProps) {
  const { isAnalyzing, aiError, handleAiAutofill } = useAiAutofill({
    form,
    categories,
  })

  return (
    <>
      <FormField
        control={control}
        name="imageUrl"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between gap-2">
              <FormLabel>Image URL</FormLabel>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={isAnalyzing || isPending}
                onClick={handleAiAutofill}
              >
                {isAnalyzing ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                {isAnalyzing ? "Analyzing product visual..." : "AI Autofill"}
              </Button>
            </div>
            <FormControl>
              <Input
                placeholder="https://example.com/image.jpg"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <p className="text-xs text-muted-foreground">
              Add a product photo URL or a few keywords above, then let AI draft
              the title, description, category, and tags.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
      {aiError && <p className="text-sm text-destructive">{aiError}</p>}
    </>
  )
}
