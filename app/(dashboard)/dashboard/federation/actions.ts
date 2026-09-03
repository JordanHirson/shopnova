"use server"

import { revalidatePath } from "next/cache"
import { federationLinkSchema } from "@/lib/validations/federation"
import {
  createFederationLink,
  deleteFederationLink,
  runFederationSync,
} from "@/lib/db"
import { requireAdmin, AdminRequiredError, UnauthenticatedError } from "@/lib/auth/admin"

export type FederationActionState = {
  error?: string
}

/** Maps admin-auth/expected errors to a short user-facing message. */
function errorMessage(err: unknown): string {
  if (err instanceof UnauthenticatedError) return err.message
  if (err instanceof AdminRequiredError) return err.message
  return err instanceof Error ? err.message : "Something went wrong."
}

export async function createFederationLinkAction(
  _prevState: FederationActionState,
  formData: FormData
): Promise<FederationActionState> {
  // SECURITY: authorize before any DB writes.
  try {
    await requireAdmin()
  } catch (err) {
    return { error: errorMessage(err) }
  }

  const parsed = federationLinkSchema.safeParse({
    name: formData.get("name"),
    source: formData.get("source"),
    categoryId: formData.get("categoryId"),
    markupType: formData.get("markupType"),
    markupValue: Number(formData.get("markupValue")),
    syncIntervalMinutes: Number(formData.get("syncIntervalMinutes")),
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid federation source data.",
    }
  }

  try {
    await createFederationLink({
      name: parsed.data.name,
      source: parsed.data.source,
      config: {
        markup: { type: parsed.data.markupType, value: parsed.data.markupValue },
        syncIntervalMinutes: parsed.data.syncIntervalMinutes,
        categoryId: parsed.data.categoryId,
      },
    })
    revalidatePath("/dashboard/federation")
    return {}
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create federation source.",
    }
  }
}

export async function runFederationSyncAction(
  _prevState: FederationActionState,
  formData: FormData
): Promise<FederationActionState> {
  try {
    await requireAdmin()
  } catch (err) {
    return { error: errorMessage(err) }
  }

  const linkId = formData.get("linkId")
  if (typeof linkId !== "string" || !linkId) {
    return { error: "Federation source id is required." }
  }

  try {
    await runFederationSync(linkId)
    revalidatePath("/dashboard/federation")
    revalidatePath("/dashboard/products")
    revalidatePath("/products")
    return {}
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Sync failed.",
    }
  }
}

export async function deleteFederationLinkAction(
  _prevState: FederationActionState,
  formData: FormData
): Promise<FederationActionState> {
  try {
    await requireAdmin()
  } catch (err) {
    return { error: errorMessage(err) }
  }

  const linkId = formData.get("linkId")
  if (typeof linkId !== "string" || !linkId) {
    return { error: "Federation source id is required." }
  }

  try {
    await deleteFederationLink(linkId)
    revalidatePath("/dashboard/federation")
    revalidatePath("/dashboard/products")
    revalidatePath("/products")
    return {}
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to remove federation source.",
    }
  }
}
