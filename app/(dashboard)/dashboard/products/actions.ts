"use server"

import { revalidatePath } from "next/cache"
import { productSchema } from "@/lib/validations/product"
import {
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  permanentlyDeleteProduct,
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

/**
 * Parses an optional non-negative-integer form field (string) into `number |
 * null`. An empty/missing value becomes null so the column is cleared. The
 * Zod schema already rejects negative/non-integer input before this runs.
 */
function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null
}

/** Collects the product form's shared field values from FormData. */
function productFormValues(formData: FormData) {
  return {
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
    price: formData.get("price"),
    compareAtPrice: formData.get("compareAtPrice") || null,
    sku: formData.get("sku") || null,
    categoryId: formData.get("categoryId"),
    imageUrl: formData.get("imageUrl") || null,
    stock: formData.get("stock") || null,
    weightGrams: formData.get("weightGrams") || null,
    lengthCm: formData.get("lengthCm") || null,
    widthCm: formData.get("widthCm") || null,
    heightCm: formData.get("heightCm") || null,
  }
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

  const parsed = productSchema.safeParse(productFormValues(formData))

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
      weightGrams: parseOptionalInt(formData.get("weightGrams")),
      lengthCm: parseOptionalInt(formData.get("lengthCm")),
      widthCm: parseOptionalInt(formData.get("widthCm")),
      heightCm: parseOptionalInt(formData.get("heightCm")),
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

  const parsed = productSchema.safeParse(productFormValues(formData))

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
      weightGrams: parseOptionalInt(formData.get("weightGrams")),
      lengthCm: parseOptionalInt(formData.get("lengthCm")),
      widthCm: parseOptionalInt(formData.get("widthCm")),
      heightCm: parseOptionalInt(formData.get("heightCm")),
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

export async function permanentlyDeleteProductAction(
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
    // Hard-delete the product row entirely. Refuses products that appear on
    // past orders (OrderItem uses onDelete: Restrict) — archive instead.
    await permanentlyDeleteProduct(id)
    revalidatePath("/dashboard/products")
    revalidatePath("/products")
    return {}
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete product.",
    }
  }
}
