import { revalidatePath } from "next/cache"
import type { ZodType } from "zod"

export type ActionState = {
  error?: string
}

export interface EntityActionConfig<TValues> {
  /** Lowercase singular entity name, e.g. "category". */
  label: string
  /** Path revalidated after a successful mutation. */
  revalidate: string
  schema: ZodType<TValues>
  /** Maps submitted form data onto the shape expected by `schema`. */
  fromFormData: (formData: FormData) => unknown
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

async function run(
  revalidate: string,
  fallbackError: string,
  mutate: () => Promise<unknown>
): Promise<ActionState> {
  try {
    await mutate()
    revalidatePath(revalidate)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : fallbackError }
  }
}

function parse<TValues>(
  config: EntityActionConfig<TValues>,
  formData: FormData
): { data: TValues } | { error: string } {
  const parsed = config.schema.safeParse(config.fromFormData(formData))
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? `Invalid ${config.label} data.`,
    }
  }

  return { data: parsed.data }
}

function readId(label: string, formData: FormData) {
  const id = formData.get("id")
  if (typeof id !== "string" || !id) {
    return { error: `${capitalize(label)} id is required.` }
  }

  return { id }
}

export async function createEntity<TValues>(
  config: EntityActionConfig<TValues>,
  formData: FormData,
  create: (values: TValues) => Promise<unknown>
): Promise<ActionState> {
  const parsed = parse(config, formData)
  if ("error" in parsed) return parsed

  return run(config.revalidate, `Failed to create ${config.label}.`, () =>
    create(parsed.data)
  )
}

export async function updateEntity<TValues>(
  config: EntityActionConfig<TValues>,
  formData: FormData,
  update: (id: string, values: TValues) => Promise<unknown>
): Promise<ActionState> {
  const identified = readId(config.label, formData)
  if ("error" in identified) return identified

  const parsed = parse(config, formData)
  if ("error" in parsed) return parsed

  return run(config.revalidate, `Failed to update ${config.label}.`, () =>
    update(identified.id, parsed.data)
  )
}

export async function deleteEntity<TValues>(
  config: EntityActionConfig<TValues>,
  formData: FormData,
  remove: (id: string) => Promise<unknown>
): Promise<ActionState> {
  const identified = readId(config.label, formData)
  if ("error" in identified) return identified

  return run(config.revalidate, `Failed to delete ${config.label}.`, () =>
    remove(identified.id)
  )
}
