"use server"

import {
  createEntity,
  deleteEntity,
  updateEntity,
  type ActionState,
  type EntityActionConfig,
} from "@/lib/actions/crud"
import {
  productSchema,
  type ProductFormValues,
} from "@/lib/validations/product"
import { createProduct, updateProduct, deleteProduct } from "@/lib/db"

export type ProductActionState = ActionState

const productConfig: EntityActionConfig<ProductFormValues> = {
  label: "product",
  revalidate: "/dashboard/products",
  schema: productSchema,
  fromFormData: (formData) => ({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || null,
    price: formData.get("price"),
    compareAtPrice: formData.get("compareAtPrice") || null,
    sku: formData.get("sku") || null,
    categoryId: formData.get("categoryId"),
  }),
}

export async function createProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  return createEntity(productConfig, formData, createProduct)
}

export async function updateProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  return updateEntity(productConfig, formData, updateProduct)
}

export async function deleteProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  return deleteEntity(productConfig, formData, deleteProduct)
}
