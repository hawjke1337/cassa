"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Plus, Copy, Trash2, Star, Printer } from "lucide-react"
import { PrintLabelsDialog } from "@/components/price-labels/print-labels-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  getTemplates, createTemplate, deleteTemplate, duplicateTemplate, setDefaultTemplate,
} from "@/actions/price-labels"
import { formatDate } from "@/lib/format"
import { DEFAULT_LAYOUT } from "@/components/price-labels/label-constants"
import { toast } from "sonner"

interface TemplateRow {
  id: string
  name: string
  width: number
  height: number
  isDefault: boolean
  createdAt: string
}

interface TemplateTableProps {
  storeId: string
}

export function TemplateTable({ storeId }: TemplateTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadTemplates = useCallback(() => {
    setIsLoading(true)
    startTransition(async () => {
      try {
        const result = await getTemplates(storeId)
        setTemplates(result)
      } finally {
        setIsLoading(false)
      }
    })
  }, [storeId])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  async function handleCreate() {
    startTransition(async () => {
      try {
        const result = await createTemplate({
          storeId,
          name: "Новый шаблон",
          layout: DEFAULT_LAYOUT,
        })
        router.push(`/settings/price-labels/${result.id}`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка создания")
      }
    })
  }

  async function handleDuplicate(id: string) {
    startTransition(async () => {
      try {
        await duplicateTemplate(id)
        toast.success("Шаблон скопирован")
        loadTemplates()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка копирования")
      }
    })
  }

  async function handleDelete() {
    if (!deleteId) return
    startTransition(async () => {
      try {
        await deleteTemplate(deleteId)
        toast.success("Шаблон удалён")
        setDeleteId(null)
        loadTemplates()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка удаления")
      }
    })
  }

  async function handleSetDefault(id: string) {
    startTransition(async () => {
      try {
        await setDefaultTemplate(id)
        toast.success("Шаблон по умолчанию обновлён")
        loadTemplates()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Шаблоны ценников</h2>
        <Button onClick={handleCreate} disabled={isPending}>
          <Plus className="size-4" />
          Создать шаблон
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Размер</TableHead>
              <TableHead>Дата создания</TableHead>
              <TableHead className="w-[200px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Нет шаблонов. Создайте первый шаблон.
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/settings/price-labels/${t.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {t.name}
                      {t.isDefault && (
                        <Star className="size-4 fill-yellow-400 text-yellow-400" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{t.width} x {t.height} мм</TableCell>
                  <TableCell>{formatDate(t.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <PrintLabelsDialog
                        trigger={
                          <Button variant="ghost" size="icon" title="Печать">
                            <Printer className="size-4" />
                          </Button>
                        }
                      />
                      {!t.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="По умолчанию"
                          onClick={() => handleSetDefault(t.id)}
                          disabled={isPending}
                        >
                          <Star className="size-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Копировать"
                        onClick={() => handleDuplicate(t.id)}
                        disabled={isPending}
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Удалить"
                        onClick={() => setDeleteId(t.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить шаблон?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
