"use server"

import { revalidatePath } from "next/cache"
import { categorySchema } from "@/lib/validations/category"
import { getCurrentUserId } from "@/lib/auth"
import { toClientErrorMessage, UNAUTHORIZED_MESSAGE } from "@/lib/errors"
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/db"

export type CategoryActionState = {
  error?: string
}

export async function createCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  if (!(await getCurrentUserId())) {
    return { error: UNAUTHORIZED_MESSAGE }
  }

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid category data.",
    }
  }

  try {
    await createCategory(parsed.data)
    revalidatePath("/dashboard/categories")
    return {}
  } catch (err) {
    return { error: toClientErrorMessage(err, "Failed to create category.") }
  }
}

export async function updateCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  if (!(await getCurrentUserId())) {
    return { error: UNAUTHORIZED_MESSAGE }
  }

  const id = formData.get("id")
  if (typeof id !== "string" || !id) {
    return { error: "Category id is required." }
  }

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid category data.",
    }
  }

  try {
    await updateCategory(id, parsed.data)
    revalidatePath("/dashboard/categories")
    return {}
  } catch (err) {
    return { error: toClientErrorMessage(err, "Failed to update category.") }
  }
}

export async function deleteCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  if (!(await getCurrentUserId())) {
    return { error: UNAUTHORIZED_MESSAGE }
  }

  const id = formData.get("id")
  if (typeof id !== "string" || !id) {
    return { error: "Category id is required." }
  }

  try {
    await deleteCategory(id)
    revalidatePath("/dashboard/categories")
    return {}
  } catch (err) {
    return { error: toClientErrorMessage(err, "Failed to delete category.") }
  }
}
