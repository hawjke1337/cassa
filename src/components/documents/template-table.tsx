"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Plus, Copy, Trash2, Star } from "lucide-react"
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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  getDocumentTemplates,
  createDocumentTemplate,
  deleteDocumentTemplate,
  duplicateDocumentTemplate,
  setDefaultDocumentTemplate,
} from "@/actions/document-templates"
import { formatDate } from "@/lib/format"
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from "@/lib/validations/document-templates"
import type { DocumentType } from "@/lib/validations/document-templates"
import { toast } from "sonner"

interface TemplateRow {
  id: string
  name: string
  type: string
  isDefault: boolean
  createdAt: string
}

interface DocumentTemplateTableProps {
  storeId: string
}

const DEFAULT_LAYOUT = {
  blocks: [],
  pageMargin: 10,
  fontFamily: "sans-serif" as const,
}

export function DocumentTemplateTable({ storeId }: DocumentTemplateTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newName, setNewName] = useState("Новый шаблон")
  const [newType, setNewType] = useState<DocumentType>("SALE_RECEIPT")

  const loadTemplates = useCallback(() => {
    setIsLoading(true)
    startTransition(async () => {
      try {
        const result = await getDocumentTemplates(storeId)
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
        const result = await createDocumentTemplate({
          storeId,
          name: newName,
          type: newType,
          layout: DEFAULT_LAYOUT,
        })
        setShowCreateDialog(false)
        router.push(`/settings/document-templates/${result.id}`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка создания")
      }
    })
  }

  async function handleDuplicate(id: string) {
    startTransition(async () => {
      try {
        await duplicateDocumentTemplate(id)
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
        await deleteDocumentTemplate(deleteId)
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
        await setDefaultDocumentTemplate(id)
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
        <h2 className="text-lg font-semibold">Шаблоны документов</h2>
        <Button onClick={() => setShowCreateDialog(true)} disabled={isPending}>
          <Plus className="size-4" />
          Создать шаблон
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Тип документа</TableHead>
              <TableHead>Дата создания</TableHead>
              <TableHead className="w-[160px]">Действия</TableHead>
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
                  onClick={() => router.push(`/settings/document-templates/${t.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {t.name}
                      {t.isDefault && (
                        <Star className="size-4 fill-yellow-400 text-yellow-400" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {DOCUMENT_TYPE_LABELS[t.type as DocumentType] ?? t.type}
                  </TableCell>
                  <TableCell>{formatDate(t.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
                      {!t.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Удалить"
                          onClick={() => setDeleteId(t.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать шаблон документа</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-type">Тип документа</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as DocumentType)}>
                <SelectTrigger id="template-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {DOCUMENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-name">Название</Label>
              <Input
                id="template-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreate} disabled={isPending || !newName.trim()}>
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
