"use server"

import { revalidatePath } from "next/cache"
import { categorySchema } from "@/lib/validations/category"
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/db"
import { toUserMessage } from "@/lib/errors"

export type CategoryActionState = {
  error?: string
}

export async function createCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
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
    return {
      error: toUserMessage(
        "createCategoryAction",
        err,
        "Failed to create category."
      ),
    }
  }
}

export async function updateCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
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
    return {
      error: toUserMessage(
        "updateCategoryAction",
        err,
        "Failed to update category."
      ),
    }
  }
}

export async function deleteCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const id = formData.get("id")
  if (typeof id !== "string" || !id) {
    return { error: "Category id is required." }
  }

  try {
    await deleteCategory(id)
    revalidatePath("/dashboard/categories")
    return {}
  } catch (err) {
    return {
      error: toUserMessage(
        "deleteCategoryAction",
        err,
        "Failed to delete category."
      ),
    }
  }
}
