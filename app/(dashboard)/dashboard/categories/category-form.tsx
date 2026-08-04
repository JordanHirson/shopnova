"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  categorySchema,
  type CategoryFormValues,
} from "@/lib/validations/category"
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  type CategoryActionState,
} from "./actions"

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  _count: { products: number }
}

interface CategoryFormProps {
  category?: Category
  onSuccess?: () => void
}

export function CategoryForm({ category, onSuccess }: CategoryFormProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()
  const isEdit = Boolean(category)

  const action = isEdit ? updateCategoryAction : createCategoryAction

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
    },
  })

  function handleSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const result = await action({} as CategoryActionState, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        onSuccess?.()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={isEdit ? "ghost" : "default"} size={isEdit ? "icon-sm" : "default"}>
            {isEdit ? <Pencil /> : <Plus />}
            {!isEdit && "Add Category"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Category" : "Create Category"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the category details below."
              : "Add a new category to organize your products."}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit}>
          {isEdit && <input type="hidden" name="id" value={category!.id} />}
          <div className="grid gap-4">
            <Form {...form}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Electronics" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. electronics" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional description"
                        className="min-h-20"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Form>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteCategoryButton({ category }: { category: Category }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()

  function handleDelete(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const result = await deleteCategoryAction({} as CategoryActionState, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive">
            <Trash2 />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Category</DialogTitle>
          <DialogDescription>
            {`Are you sure you want to delete "${category.name}"? This action cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        <form action={handleDelete}>
          <input type="hidden" name="id" value={category.id} />
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}