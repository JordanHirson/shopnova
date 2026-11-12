"use client"

import { useState } from "react"
import type { UseFormReturn } from "react-hook-form"

import type { Category } from "@/lib/types/product"
import type { ProductFormValues } from "@/lib/validations/product"

export interface UseAiAutofillProps {
  form: UseFormReturn<ProductFormValues>
  categories: Category[]
}

export interface UseAiAutofillReturn {
  isAnalyzing: boolean
  aiError: string | undefined
  handleAiAutofill: () => Promise<void>
}

/**
 * Calls the AI generate-product endpoint with the current keywords/image
 * and autofills the form fields. Generated tags are folded into the
 * description (the Product model has no tags column) so the merchant can
 * review and edit everything before saving.
 */
export function useAiAutofill({
  form,
  categories,
}: UseAiAutofillProps): UseAiAutofillReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiError, setAiError] = useState<string | undefined>()

  async function handleAiAutofill(): Promise<void> {
    setAiError(undefined)
    setIsAnalyzing(true)
    try {
      const keywords = [
        form.getValues("name"),
        form.getValues("description"),
      ]
        .filter(Boolean)
        .join(" ")
        .trim()

      const imageUrl = form.getValues("imageUrl") ?? ""

      const res = await fetch("/api/ai/generate-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: keywords || undefined,
          imageUrl: imageUrl || undefined,
        }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? "AI generation failed.")
      }

      const data = (await res.json()) as {
        title: string
        description: string
        tags: string[]
        suggestedPrice: string
        categorySlug: string
      }

      const matchedCategory = categories.find((c) => c.slug === data.categorySlug)

      const descriptionWithTags =
        data.tags.length > 0
          ? `${data.description}\n\nTags: ${data.tags.join(", ")}`
          : data.description

      form.setValue("name", data.title, { shouldValidate: true })
      form.setValue("slug", slugify(data.title), { shouldValidate: true })
      form.setValue("description", descriptionWithTags, { shouldValidate: true })
      form.setValue("price", data.suggestedPrice, { shouldValidate: true })
      if (matchedCategory) {
        form.setValue("categoryId", matchedCategory.id, { shouldValidate: true })
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI generation failed.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  return { isAnalyzing, aiError, handleAiAutofill }
}

/** Converts a title into a URL-friendly slug matching the validation regex. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
