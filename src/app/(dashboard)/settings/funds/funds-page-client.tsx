"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Power, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
  createFund,
  updateFund,
  toggleFundActive,
} from "@/actions/funds"
import { toast } from "sonner"

type Fund = {
  id: string
  name: string
  storeId: string | null
  storeName: string | null
  isActive: boolean
  createdAt: string
}

interface FundsPageClientProps {
  initialFunds: Fund[]
}

const emptyForm = { name: "" }

export function FundsPageClient({ initialFunds }: FundsPageClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFund, setEditingFund] = useState<Fund | null>(null)
  const [form, setForm] = useState(emptyForm)

  const isEdit = editingFund !== null

  function openCreate() {
    setEditingFund(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(fund: Fund) {
    setEditingFund(fund)
    setForm({ name: fund.name })
    setDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setEditingFund(null)
      setForm(emptyForm)
    }
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Укажите название фонда")
      return
    }

    startTransition(async () => {
      try {
        if (isEdit && editingFund) {
          await updateFund(editingFund.id, { name: form.name.trim() })
          toast.success("Фонд обновлён")
        } else {
          await createFund({ name: form.name.trim() })
          toast.success("Фонд создан")
        }

        setDialogOpen(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка сохранения")
      }
    })
  }

  async function handleToggle(id: string) {
    try {
      await toggleFundActive(id)
      toast.success("Статус изменён")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Фонды</h1>
          <p className="text-muted-foreground">
            Управление фондами для кассовых операций
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger
            render={
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" />
                Создать фонд
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {isEdit ? "Редактировать фонд" : "Новый фонд"}
              </DialogTitle>
              <DialogDescription>
                {isEdit
                  ? "Измените данные фонда"
                  : "Заполните данные нового фонда"}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="fund-name">Название *</Label>
                <Input
                  id="fund-name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Инкассация"
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
              <TableHead>Название</TableHead>
              <TableHead>Магазин</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialFunds.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  Нет фондов
                </TableCell>
              </TableRow>
            ) : (
              initialFunds.map((fund) => (
                <TableRow key={fund.id}>
                  <TableCell className="font-medium">{fund.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {fund.storeName ?? "Глобальный"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={fund.isActive ? "secondary" : "outline"}>
                      {fund.isActive ? "Активен" : "Неактивен"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(fund)}
                      >
                        <Pencil className="size-4" />
                        <span className="sr-only">Редактировать</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggle(fund.id)}
                      >
                        <Power className={`size-4 ${fund.isActive ? "text-green-600" : "text-muted-foreground"}`} />
                        <span className="sr-only">
                          {fund.isActive ? "Деактивировать" : "Активировать"}
                        </span>
                      </Button>
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
