export interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  price: { toString(): string }
  compareAtPrice: { toString(): string } | null
  sku: string | null
  categoryId: string
  archived: boolean
  category: { id: string; name: string }
  images: { url: string }[]
  inventory: { quantity: number } | null
  weightGrams: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  federation: { id: string; name: string; source: string } | null
}

export interface Category {
  id: string
  name: string
  slug: string
}
