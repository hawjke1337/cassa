"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Pencil, Trash2, Plus, ChevronRight, FolderOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import { getCategories, createCategory, updateCategory, deleteCategory } from "@/actions/catalog"
import { CategoryForm, type CategoryFormValues } from "@/components/catalog/category-form"

interface CategoryItem {
  id: string
  name: string
  parentId: string | null
  productCount: number
  isSerialized: boolean
  identifierType: "IMEI" | "SN" | "BOTH" | null
}

interface CategoryManagerProps {
  canEdit: boolean
  isAdmin: boolean // settings.stores permission → can force-override isSerialized
}

export function CategoryManager({ canEdit, isAdmin }: CategoryManagerProps) {
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Add/Edit form state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formInitialValues, setFormInitialValues] = useState<
    (Partial<CategoryFormValues> & { id?: string; parentId?: string | null }) | undefined
  >(undefined)

  const loadCategories = async () => {
    setIsLoading(true)
    try {
      const data = await getCategories()
      setCategories(data)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const openCreate = (parentId?: string) => {
    setEditingId(null)
    setFormInitialValues({ parentId: parentId ?? null, isSerialized: false })
    setDialogOpen(true)
  }

  const openEdit = (cat: CategoryItem) => {
    setEditingId(cat.id)
    setFormInitialValues({
      id: cat.id,
      name: cat.name,
      parentId: cat.parentId,
      isSerialized: cat.isSerialized,
      identifierType: cat.identifierType,
    })
    setDialogOpen(true)
  }

  const handleCategoryFormSubmit = async (values: CategoryFormValues) => {
    try {
      const data = {
        name: values.name,
        parentId: formInitialValues?.parentId ?? null,
        isSerialized: values.isSerialized,
        identifierType: values.isSerialized ? (values.identifierType ?? "IMEI") : null,
        forceOverride: values.forceOverride,
        forceReason: values.forceReason,
      }
      if (editingId) {
        await updateCategory(editingId, data)
        toast.success("Категория обновлена")
      } else {
        await createCategory(data)
        toast.success("Категория создана")
      }
      setDialogOpen(false)
      await loadCategories()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Произошла ошибка"
      toast.error(message)
    }
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteCategory(id)
        toast.success("Категория удалена")
        await loadCategories()
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Произошла ошибка"
        toast.error(message)
      }
    })
  }

  // Build tree structure for display
  const rootCategories = categories.filter((c) => !c.parentId)
  const getChildren = (parentId: string) => categories.filter((c) => c.parentId === parentId)

  const renderCategory = (cat: CategoryItem, depth: number) => {
    const children = getChildren(cat.id)
    const hasProducts = cat.productCount > 0
    const hasChildren = children.length > 0

    return (
      <div key={cat.id}>
        <div
          className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
          style={{ paddingLeft: `${depth * 24 + 8}px` }}
        >
          {hasChildren ? (
            <ChevronRight className="size-4 text-muted-foreground" />
          ) : (
            <FolderOpen className="size-4 text-muted-foreground" />
          )}
          <span className="flex-1 text-sm font-medium">{cat.name}</span>
          <Badge variant="secondary" className="text-xs">
            {cat.productCount}
          </Badge>
          {canEdit && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon-xs" onClick={() => openEdit(cat)}>
                <Pencil className="size-3" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="ghost" size="icon-xs" disabled={hasProducts || hasChildren} />
                  }
                >
                  <Trash2 className="size-3" />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить категорию?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Категория &quot;{cat.name}&quot; будет удалена. Это действие нельзя отменить.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(cat.id)} variant="destructive">
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
        {children.map((child) => renderCategory(child, depth + 1))}
      </div>
    )
  }

  // Filter available parents for the form (exclude self and children when editing)
  const availableParents = editingId
    ? categories.filter((c) => c.id !== editingId && c.parentId !== editingId)
    : categories

  return (
    <div className="space-y-4">
      {canEdit && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" />
            Добавить категорию
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Редактировать категорию" : "Новая категория"}</DialogTitle>
            </DialogHeader>
            <CategoryForm
              initialValues={formInitialValues}
              isAdmin={isAdmin}
              onSubmit={handleCategoryFormSubmit}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      <div className="rounded-lg border">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Загрузка...</div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Категории не найдены</div>
        ) : (
          <div className="divide-y">{rootCategories.map((cat) => renderCategory(cat, 0))}</div>
        )}
      </div>
    </div>
  )
}
