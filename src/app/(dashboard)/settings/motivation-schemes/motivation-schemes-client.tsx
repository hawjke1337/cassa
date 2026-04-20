"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Archive, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createMotivationScheme,
  archiveMotivationScheme,
  approveMotivationScheme,
  rejectMotivationScheme,
} from "@/actions/motivation-schemes"
import { getUserStores } from "@/actions/stores"
import { toast } from "sonner"

type MotivationScheme = {
  id: string
  name: string
  status: "ACTIVE" | "PENDING_APPROVAL" | "ARCHIVED"
  storeName: string
  storeId: string | null
  assignmentCount: number
  createdByName: string
}

type Store = {
  id: string
  name: string
}

interface MotivationSchemesClientProps {
  initialSchemes: MotivationScheme[]
  canApprove: boolean
}

const DEFAULT_FORMULA = {
  dailyRate: 1000,
  commissionRules: [],
  defaultCommission: { rate: 0.10, basis: "PROFIT" as const },
  crossSellBonuses: [
    { minItems: 2, bonus: 200 },
    { minItems: 3, bonus: 400 },
    { minItems: 4, bonus: 600 },
  ],
  repairBonus: 300,
}

const STATUS_LABELS: Record<MotivationScheme["status"], string> = {
  ACTIVE: "Активна",
  PENDING_APPROVAL: "Ожидает подтверждения",
  ARCHIVED: "В архиве",
}

const STATUS_BADGE_CLASSES: Record<MotivationScheme["status"], string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  ARCHIVED: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
}

const emptyForm = { name: "", storeId: "" }

export function MotivationSchemesClient({
  initialSchemes,
  canApprove,
}: MotivationSchemesClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [stores, setStores] = useState<Store[]>([])

  useEffect(() => {
    getUserStores().then(setStores).catch(() => {})
  }, [])

  function openCreate() {
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setForm(emptyForm)
    }
  }

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Укажите название схемы")
      return
    }

    startTransition(async () => {
      try {
        await createMotivationScheme({
          name: form.name.trim(),
          storeId: form.storeId || null,
          formula: DEFAULT_FORMULA,
        })
        toast.success("Схема мотивации создана")
        setDialogOpen(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка создания схемы")
      }
    })
  }

  async function handleArchive(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await archiveMotivationScheme(id)
      toast.success("Схема перемещена в архив")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка архивации")
    }
  }

  async function handleApprove(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await approveMotivationScheme(id)
      toast.success("Схема подтверждена")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка подтверждения")
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectMotivationScheme(id)
      toast.success("Схема отклонена")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка отклонения")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Схемы мотивации
          </h1>
          <p className="text-muted-foreground">
            Управление схемами мотивации для сотрудников
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger
            render={
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" />
                Создать схему
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Новая схема мотивации</DialogTitle>
              <DialogDescription>
                Заполните данные новой схемы мотивации
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="scheme-name">Название *</Label>
                <Input
                  id="scheme-name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Базовая схема"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="scheme-store">Магазин</Label>
                <Select
                  value={form.storeId || "global"}
                  onValueChange={(val) =>
                    updateField("storeId", val === "global" ? "" : (val ?? ""))
                  }
                >
                  <SelectTrigger id="scheme-store">
                    <SelectValue placeholder="Все магазины (глобальный шаблон)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">
                      Все магазины (глобальный шаблон)
                    </SelectItem>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Магазин</TableHead>
              <TableHead>Назначений</TableHead>
              <TableHead>Создал</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialSchemes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  Нет схем мотивации
                </TableCell>
              </TableRow>
            ) : (
              initialSchemes.map((scheme) => (
                <TableRow
                  key={scheme.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/settings/motivation-schemes/${scheme.id}`)
                  }
                >
                  <TableCell className="font-medium">{scheme.name}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[scheme.status]}`}
                    >
                      {STATUS_LABELS[scheme.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {scheme.storeName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {scheme.assignmentCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {scheme.createdByName}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {scheme.status === "ACTIVE" && (
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Archive className="size-4 text-muted-foreground" />
                                <span className="sr-only">Архивировать</span>
                              </Button>
                            }
                          />
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Архивировать схему?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Схема &quot;{scheme.name}&quot; будет перемещена в архив. Это
                                действие нельзя отменить.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Отмена</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={(e) => handleArchive(scheme.id, e)}
                              >
                                Архивировать
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      {scheme.status === "PENDING_APPROVAL" && canApprove && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => handleApprove(scheme.id, e)}
                          >
                            <CheckCircle className="size-4 text-green-600" />
                            <span className="sr-only">Подтвердить</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <XCircle className="size-4 text-red-500" />
                                  <span className="sr-only">Отклонить</span>
                                </Button>
                              }
                            />
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Отклонить схему?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Схема &quot;{scheme.name}&quot; будет отклонена и
                                  перемещена в архив.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Отмена</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleReject(scheme.id)}
                                >
                                  Отклонить
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
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
