"use server"

import { revalidatePath } from "next/cache"
import { productSchema } from "@/lib/validations/product"
import {
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
} from "@/lib/db"
import { requireAdmin, AdminRequiredError, UnauthenticatedError } from "@/lib/auth/admin"

export type ProductActionState = {
  error?: string
}

/** Maps admin-auth/expected errors to a short user-facing message. */
function errorMessage(err: unknown): string {
  if (err instanceof UnauthenticatedError) return err.message
  if (err instanceof AdminRequiredError) return err.message
  return err instanceof Error ? err.message : "Something went wrong."
}

export async function createProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  // SECURITY: authorize before any validation side effects or DB writes.
  // A normal customer calling this server action directly is rejected here.
  try {
    await requireAdmin()
  } catch (err) {
    return { error: errorMessage(err) }
  }

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
    price: formData.get("price"),
    compareAtPrice: formData.get("compareAtPrice") || null,
    sku: formData.get("sku") || null,
    categoryId: formData.get("categoryId"),
    imageUrl: formData.get("imageUrl") || null,
    stock: formData.get("stock") || null,
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid product data.",
    }
  }

  try {
    await createProduct({
      ...parsed.data,
      imageUrl: parsed.data.imageUrl || null,
      stock: parsed.data.stock ? Number(parsed.data.stock) : null,
    })
    revalidatePath("/dashboard/products")
    revalidatePath("/products")
    return {}
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create product.",
    }
  }
}

export async function updateProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  try {
    await requireAdmin()
  } catch (err) {
    return { error: errorMessage(err) }
  }

  const id = formData.get("id")
  if (typeof id !== "string" || !id) {
    return { error: "Product id is required." }
  }

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
    price: formData.get("price"),
    compareAtPrice: formData.get("compareAtPrice") || null,
    sku: formData.get("sku") || null,
    categoryId: formData.get("categoryId"),
    imageUrl: formData.get("imageUrl") || null,
    stock: formData.get("stock") || null,
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid product data.",
    }
  }

  try {
    await updateProduct(id, {
      ...parsed.data,
      imageUrl: parsed.data.imageUrl || null,
      stock: parsed.data.stock ? Number(parsed.data.stock) : null,
    })
    revalidatePath("/dashboard/products")
    revalidatePath("/products")
    return {}
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update product.",
    }
  }
}

export async function deleteProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  try {
    await requireAdmin()
  } catch (err) {
    return { error: errorMessage(err) }
  }

  const id = formData.get("id")
  if (typeof id !== "string" || !id) {
    return { error: "Product id is required." }
  }

  try {
    // Soft-delete (archive) so historical OrderItem references stay intact.
    await deleteProduct(id)
    revalidatePath("/dashboard/products")
    revalidatePath("/products")
    return {}
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to archive product.",
    }
  }
}

export async function restoreProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  try {
    await requireAdmin()
  } catch (err) {
    return { error: errorMessage(err) }
  }

  const id = formData.get("id")
  if (typeof id !== "string" || !id) {
    return { error: "Product id is required." }
  }

  try {
    await restoreProduct(id)
    revalidatePath("/dashboard/products")
    revalidatePath("/products")
    return {}
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to restore product.",
    }
  }
}
