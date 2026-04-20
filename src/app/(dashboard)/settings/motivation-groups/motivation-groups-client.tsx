"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import {
  createMotivationGroup,
  updateMotivationGroup,
  deleteMotivationGroup,
} from "@/actions/motivation-groups"
import { toast } from "sonner"

type MotivationGroup = {
  id: string
  code: string
  name: string
  description: string | null
  productCount: number
  createdAt: string
}

interface MotivationGroupsClientProps {
  initialGroups: MotivationGroup[]
}

const emptyForm = { code: "", name: "", description: "" }

export function MotivationGroupsClient({
  initialGroups,
}: MotivationGroupsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<MotivationGroup | null>(null)
  const [form, setForm] = useState(emptyForm)

  const isEdit = editingGroup !== null

  function openCreate() {
    setEditingGroup(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(group: MotivationGroup, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingGroup(group)
    setForm({
      code: group.code,
      name: group.name,
      description: group.description ?? "",
    })
    setDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setEditingGroup(null)
      setForm(emptyForm)
    }
  }

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit() {
    if (!form.code.trim()) {
      toast.error("Укажите код группы")
      return
    }
    if (!form.name.trim()) {
      toast.error("Укажите название группы")
      return
    }

    startTransition(async () => {
      try {
        const data = {
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        }

        if (isEdit && editingGroup) {
          await updateMotivationGroup(editingGroup.id, data)
          toast.success("Группа обновлена")
        } else {
          await createMotivationGroup(data)
          toast.success("Группа создана")
        }

        setDialogOpen(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка сохранения")
      }
    })
  }

  async function handleDelete(id: string) {
    try {
      await deleteMotivationGroup(id)
      toast.success("Группа удалена")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка удаления")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Мотивационные группы
          </h1>
          <p className="text-muted-foreground">
            Группировка товаров для расчёта мотивации
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger
            render={
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" />
                Создать группу
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {isEdit ? "Редактировать группу" : "Новая группа"}
              </DialogTitle>
              <DialogDescription>
                {isEdit
                  ? "Измените данные мотивационной группы"
                  : "Заполните данные новой мотивационной группы"}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="group-code">Код *</Label>
                <Input
                  id="group-code"
                  value={form.code}
                  onChange={(e) => updateField("code", e.target.value)}
                  placeholder="PREMIUM"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="group-name">Название *</Label>
                <Input
                  id="group-name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Премиум товары"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="group-description">Описание</Label>
                <Textarea
                  id="group-description"
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Описание группы..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isEdit ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Код</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Товаров</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialGroups.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  Нет мотивационных групп
                </TableCell>
              </TableRow>
            ) : (
              initialGroups.map((group) => (
                <TableRow
                  key={group.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/settings/motivation-groups/${group.id}`)
                  }
                >
                  <TableCell className="font-mono text-sm">
                    {group.code}
                  </TableCell>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {group.productCount}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => openEdit(group, e)}
                      >
                        <Pencil className="size-4" />
                        <span className="sr-only">Редактировать</span>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="size-4 text-muted-foreground" />
                              <span className="sr-only">Удалить</span>
                            </Button>
                          }
                        />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Удалить группу?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Группа &quot;{group.name}&quot; будет удалена. Это
                              действие нельзя отменить.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(group.id)}
                            >
                              Удалить
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
