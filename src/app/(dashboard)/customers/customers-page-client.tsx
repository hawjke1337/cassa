"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Search, Plus, Loader2, Trash2, RotateCcw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
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
import { toast } from "sonner"
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  softDeleteCustomer,
  restoreCustomer,
} from "@/actions/customers"

interface CustomerRow {
  id: string
  name: string
  phone: string
  passportSeries: string | null
  passportNumber: string | null
  passportIssuedBy: string | null
  passportIssuedAt: string | null
  comment: string | null
  isDeleted: boolean
  tradeInCount: number
  lastTradeInAt: string | null
}

interface CustomerForm {
  name: string
  phone: string
  passportSeries: string
  passportNumber: string
  passportIssuedBy: string
  passportIssuedAt: string
  comment: string
}

const emptyForm: CustomerForm = {
  name: "",
  phone: "",
  passportSeries: "",
  passportNumber: "",
  passportIssuedBy: "",
  passportIssuedAt: "",
  comment: "",
}

interface CustomersPageClientProps {
  canManage: boolean
}

export function CustomersPageClient({ canManage }: CustomersPageClientProps) {
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null)
  const [form, setForm] = useState<CustomerForm>(emptyForm)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    startTransition(async () => {
      try {
        const result = await getCustomers(debouncedSearch || undefined)
        setCustomers(result)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка загрузки клиентов")
      } finally {
        setLoading(false)
      }
    })
  }, [debouncedSearch])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  function openCreateDialog() {
    setEditingCustomer(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEditDialog(customer: CustomerRow) {
    setEditingCustomer(customer)
    setForm({
      name: customer.name,
      phone: customer.phone,
      passportSeries: customer.passportSeries ?? "",
      passportNumber: customer.passportNumber ?? "",
      passportIssuedBy: customer.passportIssuedBy ?? "",
      passportIssuedAt: customer.passportIssuedAt ? customer.passportIssuedAt.slice(0, 10) : "",
      comment: customer.comment ?? "",
    })
    setDialogOpen(true)
  }

  function updateField(field: keyof CustomerForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Укажите ФИО клиента")
      return
    }
    if (!form.phone.trim()) {
      toast.error("Укажите телефон клиента")
      return
    }

    startTransition(async () => {
      try {
        const data = {
          name: form.name.trim(),
          phone: form.phone.trim(),
          passportSeries: form.passportSeries || undefined,
          passportNumber: form.passportNumber || undefined,
          passportIssuedBy: form.passportIssuedBy || undefined,
          passportIssuedAt: form.passportIssuedAt ? new Date(form.passportIssuedAt) : undefined,
          comment: form.comment || undefined,
        }

        if (editingCustomer) {
          await updateCustomer(editingCustomer.id, data)
          toast.success("Клиент обновлён")
        } else {
          await createCustomer(data)
          toast.success("Клиент создан")
        }

        setDialogOpen(false)
        loadCustomers()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка сохранения")
      }
    })
  }

  const isEdit = editingCustomer !== null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Клиенты</h1>
          <p className="text-muted-foreground">База клиентов для трейд-ина и выкупа</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="size-4" />
            Добавить клиента
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Поиск по имени или телефону..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Трейд-ины</TableHead>
              <TableHead>Последний визит</TableHead>
              {canManage && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 5 : 4}
                  className="h-24 text-center text-muted-foreground"
                >
                  {debouncedSearch ? "Клиенты не найдены" : "Нет клиентов"}
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c) => (
                <TableRow
                  key={c.id}
                  className={`${c.isDeleted ? "opacity-50" : ""} ${canManage && !c.isDeleted ? "cursor-pointer hover:bg-muted/50" : ""}`}
                  onClick={canManage && !c.isDeleted ? () => openEditDialog(c) : undefined}
                >
                  <TableCell className="font-medium">
                    {c.name}
                    {c.isDeleted && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Архивирован
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{c.tradeInCount}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.lastTradeInAt ? new Date(c.lastTradeInAt).toLocaleDateString("ru-RU") : "—"}
                  </TableCell>
                  {canManage && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {c.isDeleted ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              await restoreCustomer(c.id)
                              toast.success("Клиент восстановлен")
                              loadCustomers()
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Ошибка")
                            }
                          }}
                        >
                          <RotateCcw className="mr-1 size-3" />
                          Восстановить
                        </Button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button variant="ghost" size="sm">
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            }
                          />
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Данные клиента будут сохранены, но клиент будет помечен как
                                архивный.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Отмена</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={async () => {
                                  try {
                                    await softDeleteCustomer(c.id)
                                    toast.success("Клиент архивирован")
                                    loadCustomers()
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Ошибка")
                                  }
                                }}
                              >
                                Удалить
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Редактирование клиента" : "Новый клиент"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Измените данные клиента" : "Заполните информацию о клиенте"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="customer-name">ФИО *</Label>
              <Input
                id="customer-name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Иванов Иван Иванович"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="customer-phone">Телефон *</Label>
              <Input
                id="customer-phone"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+7 999 123-45-67"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="customer-passport-series">Серия паспорта</Label>
                <Input
                  id="customer-passport-series"
                  value={form.passportSeries}
                  onChange={(e) => updateField("passportSeries", e.target.value)}
                  placeholder="1234"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer-passport-number">Номер паспорта</Label>
                <Input
                  id="customer-passport-number"
                  value={form.passportNumber}
                  onChange={(e) => updateField("passportNumber", e.target.value)}
                  placeholder="567890"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="customer-passport-issued-by">Кем выдан</Label>
              <Input
                id="customer-passport-issued-by"
                value={form.passportIssuedBy}
                onChange={(e) => updateField("passportIssuedBy", e.target.value)}
                placeholder="ОУФМС России по г. Москве"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="customer-passport-issued-at">Дата выдачи</Label>
              <Input
                id="customer-passport-issued-at"
                type="date"
                value={form.passportIssuedAt}
                onChange={(e) => updateField("passportIssuedAt", e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="customer-comment">Комментарий</Label>
              <Textarea
                id="customer-comment"
                value={form.comment}
                onChange={(e) => updateField("comment", e.target.value)}
                placeholder="Заметки о клиенте..."
                rows={3}
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
  )
}
