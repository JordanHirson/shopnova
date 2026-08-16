import { z } from "zod"
import { descriptionField, nameField, slugField } from "./common"

export const categorySchema = z.object({
  name: nameField,
  slug: slugField,
  description: descriptionField,
})

export type CategoryFormValues = z.infer<typeof categorySchema>
