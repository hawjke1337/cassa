"use client"

import { useState, useTransition } from "react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { createStore, updateStore } from "@/actions/settings"
import { toast } from "sonner"

interface StoreData {
  id?: string
  name: string
  address: string
  phone: string
}

interface StoreFormProps {
  store?: StoreData
  trigger: React.ReactNode
  onSuccess?: () => void
}

const emptyStore: StoreData = {
  name: "",
  address: "",
  phone: "",
}

export function StoreForm({ store, trigger, onSuccess }: StoreFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<StoreData>(store ?? emptyStore)

  const isEdit = Boolean(store?.id)

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setForm(store ?? emptyStore)
    }
  }

  function updateField(field: keyof StoreData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Укажите название магазина")
      return
    }
    if (!form.address.trim()) {
      toast.error("Укажите адрес магазина")
      return
    }

    startTransition(async () => {
      try {
        if (isEdit && store?.id) {
          await updateStore(store.id, {
            name: form.name,
            address: form.address,
            phone: form.phone || undefined,
          })
          toast.success("Магазин обновлён")
        } else {
          await createStore({
            name: form.name,
            address: form.address,
            phone: form.phone || undefined,
          })
          toast.success("Магазин создан")
        }
        setOpen(false)
        onSuccess?.()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка сохранения")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Редактировать магазин" : "Новый магазин"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Измените данные магазина"
              : "Заполните информацию о магазине"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="store-name">Название *</Label>
            <Input
              id="store-name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="a:store Центр"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="store-address">Адрес *</Label>
            <Input
              id="store-address"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="ул. Примерная, д. 1"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="store-phone">Телефон</Label>
            <Input
              id="store-phone"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="+7 999 123-45-67"
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
  )
}
