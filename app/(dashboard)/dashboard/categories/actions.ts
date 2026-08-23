"use server"

import { revalidatePath } from "next/cache"
import { categorySchema } from "@/lib/validations/category"
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/db"
import { requireAdmin, AdminRequiredError, UnauthenticatedError } from "@/lib/auth/admin"

export type CategoryActionState = {
  error?: string
}

/** Maps admin-auth/expected errors to a short user-facing message. */
function errorMessage(err: unknown): string {
  if (err instanceof UnauthenticatedError) return err.message
  if (err instanceof AdminRequiredError) return err.message
  return err instanceof Error ? err.message : "Something went wrong."
}

export async function createCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  // SECURITY: authorize before any DB writes.
  try {
    await requireAdmin()
  } catch (err) {
    return { error: errorMessage(err) }
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
    revalidatePath("/categories")
    return {}
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create category.",
    }
  }
}

export async function updateCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  try {
    await requireAdmin()
  } catch (err) {
    return { error: errorMessage(err) }
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
    revalidatePath("/categories")
    return {}
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update category.",
    }
  }
}

export async function deleteCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  try {
    await requireAdmin()
  } catch (err) {
    return { error: errorMessage(err) }
  }

  const id = formData.get("id")
  if (typeof id !== "string" || !id) {
    return { error: "Category id is required." }
  }

  try {
    // deleteCategory pre-checks for products and throws a clear error rather
    // than letting the onDelete: Restrict FK constraint surface as a raw error.
    await deleteCategory(id)
    revalidatePath("/dashboard/categories")
    revalidatePath("/categories")
    return {}
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete category.",
    }
  }
}
