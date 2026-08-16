"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { EntityFormDialog } from "@/components/dashboard/entity-form-dialog"
import { TextField, TextareaField } from "@/components/dashboard/form-fields"
import { Form } from "@/components/ui/form"
import { useActionDialog } from "@/hooks/use-action-dialog"
import {
  categorySchema,
  type CategoryFormValues,
} from "@/lib/validations/category"
import { createCategoryAction, updateCategoryAction } from "./actions"

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  _count: { products: number }
}

interface CategoryFormProps {
  category?: Category
  onSuccess?: () => void
}

export function CategoryForm({ category, onSuccess }: CategoryFormProps) {
  const isEdit = Boolean(category)
  const { open, setOpen, error, isPending, submit } = useActionDialog(
    isEdit ? updateCategoryAction : createCategoryAction,
    onSuccess
  )

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
    },
  })

  return (
    <EntityFormDialog
      entityLabel="Category"
      isEdit={isEdit}
      createDescription="Add a new category to organize your products."
      entityId={category?.id}
      open={open}
      onOpenChange={setOpen}
      onSubmit={submit}
      error={error}
      isPending={isPending}
    >
      <Form {...form}>
        <TextField
          control={form.control}
          name="name"
          label="Name"
          placeholder="e.g. Electronics"
        />
        <TextField
          control={form.control}
          name="slug"
          label="Slug"
          placeholder="e.g. electronics"
        />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          placeholder="Optional description"
        />
      </Form>
    </EntityFormDialog>
  )
}
