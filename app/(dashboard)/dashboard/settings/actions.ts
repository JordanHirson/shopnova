"use server"

import { revalidatePath } from "next/cache"
import { storeThemeSchema } from "@/lib/validations/store"
import { updateDefaultStoreTheme } from "@/lib/db/store"
import {
  requireAdmin,
  AdminRequiredError,
  UnauthenticatedError,
} from "@/lib/auth/admin"

export type StoreThemeActionState = {
  error?: string
  success?: boolean
}

/** Maps admin-auth/expected errors to a short user-facing message. */
function errorMessage(err: unknown): string {
  if (err instanceof UnauthenticatedError) return err.message
  if (err instanceof AdminRequiredError) return err.message
  return err instanceof Error ? err.message : "Something went wrong."
}

export async function updateStoreThemeAction(
  _prevState: StoreThemeActionState,
  formData: FormData
): Promise<StoreThemeActionState> {
  // SECURITY: authorize before any DB writes.
  try {
    await requireAdmin()
  } catch (err) {
    return { error: errorMessage(err) }
  }

  const parsed = storeThemeSchema.safeParse({
    themePreset: formData.get("themePreset"),
    primaryColor: formData.get("primaryColor"),
    accentColor: formData.get("accentColor"),
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid theme settings.",
    }
  }

  try {
    await updateDefaultStoreTheme(parsed.data)
    // Revalidate the storefront and this settings page so the new theme
    // appears immediately on both surfaces.
    revalidatePath("/", "layout")
    revalidatePath("/dashboard/settings")
    return { success: true }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to save theme settings.",
    }
  }
}
