"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createAssignment,
  endAssignment,
  deleteAssignment,
  getStoreEmployees,
} from "@/actions/motivation-assignments"
import { getUserStores } from "@/actions/stores"
import { toast } from "sonner"

type Assignment = {
  id: string
  userId: string
  userName: string
  storeId: string
  storeName: string
  startDate: string
  endDate: string | null
}

type Store = {
  id: string
  name: string
}

type Employee = {
  id: string
  name: string
  currentScheme: string | null
}

interface AssignmentManagerProps {
  schemeId: string
  assignments: Assignment[]
}

const emptyForm = {
  storeId: "",
  userId: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
}

export function AssignmentManager({
  schemeId,
  assignments,
}: AssignmentManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [stores, setStores] = useState<Store[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)

  useEffect(() => {
    getUserStores().then(setStores).catch(() => {})
  }, [])

  useEffect(() => {
    if (!form.storeId) {
      setEmployees([])
      return
    }
    setIsLoadingEmployees(true)
    getStoreEmployees(form.storeId)
      .then(setEmployees)
      .catch(() => toast.error("Ошибка загрузки сотрудников"))
      .finally(() => setIsLoadingEmployees(false))
  }, [form.storeId])

  function openAssignDialog() {
    setForm(emptyForm)
    setEmployees([])
    setDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setForm(emptyForm)
      setEmployees([])
    }
  }

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      // Reset employee when store changes
      if (field === "storeId") next.userId = ""
      return next
    })
  }

  function handleSubmit() {
    if (!form.storeId) {
      toast.error("Выберите магазин")
      return
    }
    if (!form.userId) {
      toast.error("Выберите сотрудника")
      return
    }
    if (!form.startDate) {
      toast.error("Укажите дату начала")
      return
    }

    startTransition(async () => {
      try {
        await createAssignment({
          schemeId,
          userId: form.userId,
          storeId: form.storeId,
          startDate: new Date(form.startDate),
          endDate: form.endDate ? new Date(form.endDate) : null,
        })
        toast.success("Схема назначена сотруднику")
        setDialogOpen(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка назначения")
      }
    })
  }

  function handleEndAssignment(id: string) {
    startTransition(async () => {
      try {
        await endAssignment(id)
        toast.success("Назначение завершено")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка завершения")
      }
    })
  }

  function handleDeleteAssignment(id: string) {
    startTransition(async () => {
      try {
        await deleteAssignment(id)
        toast.success("Назначение удалено")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка удаления")
      }
    })
  }

  function formatDate(isoDate: string) {
    return new Date(isoDate).toLocaleDateString("ru-RU")
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Назначения схемы на сотрудников
        </p>
        <Button size="sm" onClick={openAssignDialog}>
          <Plus className="size-4" />
          Назначить
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Сотрудник</TableHead>
              <TableHead>Магазин</TableHead>
              <TableHead>Начало</TableHead>
              <TableHead>Окончание</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  Нет назначений
                </TableCell>
              </TableRow>
            ) : (
              assignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.userName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.storeName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(a.startDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.endDate ? formatDate(a.endDate) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {!a.endDate && (
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isPending}
                              >
                                Завершить
                              </Button>
                            }
                          />
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Завершить назначение?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Назначение для {a.userName} ({a.storeName})
                                будет завершено сегодня.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Отмена</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleEndAssignment(a.id)}
                              >
                                Завершить
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isPending}
                            >
                              Удалить
                            </Button>
                          }
                        />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Удалить назначение?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Назначение для {a.userName} ({a.storeName}) будет
                              удалено безвозвратно.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteAssignment(a.id)}
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

      {/* Assign dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Назначить схему</DialogTitle>
            <DialogDescription>
              Выберите сотрудника и период действия схемы
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="assign-store">Магазин *</Label>
              <Select
                value={form.storeId || ""}
                onValueChange={(val) => updateField("storeId", val ?? "")}
              >
                <SelectTrigger id="assign-store">
                  <SelectValue placeholder="Выберите магазин" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="assign-user">Сотрудник *</Label>
              <Select
                value={form.userId || ""}
                onValueChange={(val) => updateField("userId", val ?? "")}
                disabled={!form.storeId || isLoadingEmployees}
              >
                <SelectTrigger id="assign-user">
                  <SelectValue
                    placeholder={
                      isLoadingEmployees
                        ? "Загрузка..."
                        : !form.storeId
                          ? "Сначала выберите магазин"
                          : "Выберите сотрудника"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <div className="flex flex-col">
                        <span>{e.name}</span>
                        {e.currentScheme && (
                          <span className="text-xs text-muted-foreground">
                            Текущая схема: {e.currentScheme}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="assign-start">Дата начала *</Label>
              <Input
                id="assign-start"
                type="date"
                value={form.startDate}
                onChange={(e) => updateField("startDate", e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="assign-end">
                Дата окончания{" "}
                <span className="text-muted-foreground">(необязательно)</span>
              </Label>
              <Input
                id="assign-end"
                type="date"
                value={form.endDate}
                onChange={(e) => updateField("endDate", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Назначить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
