"use server"

import { revalidatePath } from "next/cache"
import { productSchema } from "@/lib/validations/product"
import { getCurrentUserId } from "@/lib/auth"
import { toClientErrorMessage, UNAUTHORIZED_MESSAGE } from "@/lib/errors"
import {
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/lib/db"

export type ProductActionState = {
  error?: string
}

export async function createProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  if (!(await getCurrentUserId())) {
    return { error: UNAUTHORIZED_MESSAGE }
  }

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
    price: formData.get("price"),
    compareAtPrice: formData.get("compareAtPrice") || null,
    sku: formData.get("sku") || null,
    categoryId: formData.get("categoryId"),
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid product data.",
    }
  }

  try {
    await createProduct(parsed.data)
    revalidatePath("/dashboard/products")
    return {}
  } catch (err) {
    return { error: toClientErrorMessage(err, "Failed to create product.") }
  }
}

export async function updateProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  if (!(await getCurrentUserId())) {
    return { error: UNAUTHORIZED_MESSAGE }
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
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid product data.",
    }
  }

  try {
    await updateProduct(id, parsed.data)
    revalidatePath("/dashboard/products")
    return {}
  } catch (err) {
    return { error: toClientErrorMessage(err, "Failed to update product.") }
  }
}

export async function deleteProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  if (!(await getCurrentUserId())) {
    return { error: UNAUTHORIZED_MESSAGE }
  }

  const id = formData.get("id")
  if (typeof id !== "string" || !id) {
    return { error: "Product id is required." }
  }

  try {
    await deleteProduct(id)
    revalidatePath("/dashboard/products")
    return {}
  } catch (err) {
    return { error: toClientErrorMessage(err, "Failed to delete product.") }
  }
}
