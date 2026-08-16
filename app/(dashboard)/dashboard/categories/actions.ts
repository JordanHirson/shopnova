"use server"

import {
  createEntity,
  deleteEntity,
  updateEntity,
  type ActionState,
  type EntityActionConfig,
} from "@/lib/actions/crud"
import {
  categorySchema,
  type CategoryFormValues,
} from "@/lib/validations/category"
import { createCategory, updateCategory, deleteCategory } from "@/lib/db"

export type CategoryActionState = ActionState

const categoryConfig: EntityActionConfig<CategoryFormValues> = {
  label: "category",
  revalidate: "/dashboard/categories",
  schema: categorySchema,
  fromFormData: (formData) => ({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
  }),
}

export async function createCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  return createEntity(categoryConfig, formData, createCategory)
}

export async function updateCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  return updateEntity(categoryConfig, formData, updateCategory)
}

export async function deleteCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  return deleteEntity(categoryConfig, formData, deleteCategory)
}
