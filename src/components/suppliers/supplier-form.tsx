"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { createSupplier, updateSupplier } from "@/actions/suppliers"
import { toast } from "sonner"

interface SupplierData {
  id?: string
  name: string
  contactName: string
  phone: string
  email: string
  website: string
  city: string
  address: string
  inn: string
  comment: string
}

interface SupplierFormProps {
  supplier?: SupplierData
  trigger: React.ReactNode
  onSuccess?: () => void
}

const emptySupplier: SupplierData = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  website: "",
  city: "",
  address: "",
  inn: "",
  comment: "",
}

export function SupplierForm({ supplier, trigger, onSuccess }: SupplierFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<SupplierData>(supplier ?? emptySupplier)

  const isEdit = Boolean(supplier?.id)

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setForm(supplier ?? emptySupplier)
    }
  }

  function updateField(field: keyof SupplierData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Укажите название поставщика")
      return
    }

    startTransition(async () => {
      try {
        if (isEdit && supplier?.id) {
          await updateSupplier(supplier.id, {
            name: form.name,
            contactName: form.contactName,
            phone: form.phone,
            email: form.email,
            website: form.website,
            city: form.city,
            address: form.address,
            inn: form.inn,
            comment: form.comment,
          })
          toast.success("Поставщик обновлён")
        } else {
          await createSupplier({
            name: form.name,
            contactName: form.contactName || undefined,
            phone: form.phone || undefined,
            email: form.email || undefined,
            website: form.website || undefined,
            city: form.city || undefined,
            address: form.address || undefined,
            inn: form.inn || undefined,
            comment: form.comment || undefined,
          })
          toast.success("Поставщик создан")
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать поставщика" : "Новый поставщик"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Измените данные поставщика" : "Заполните информацию о поставщике"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="supplier-name">Название *</Label>
            <Input
              id="supplier-name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="ООО Поставщик"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="supplier-contact">Контактное лицо</Label>
              <Input
                id="supplier-contact"
                value={form.contactName}
                onChange={(e) => updateField("contactName", e.target.value)}
                placeholder="Иванов Иван"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-phone">Телефон</Label>
              <Input
                id="supplier-phone"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+7 999 123-45-67"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="supplier-email">Email</Label>
              <Input
                id="supplier-email"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-website">Сайт</Label>
              <Input
                id="supplier-website"
                value={form.website}
                onChange={(e) => updateField("website", e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="supplier-city">Город</Label>
              <Input
                id="supplier-city"
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
                placeholder="Москва"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-inn">ИНН</Label>
              <Input
                id="supplier-inn"
                value={form.inn}
                onChange={(e) => updateField("inn", e.target.value)}
                placeholder="1234567890"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="supplier-address">Адрес</Label>
            <Input
              id="supplier-address"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="ул. Примерная, д. 1"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="supplier-comment">Комментарий</Label>
            <Textarea
              id="supplier-comment"
              value={form.comment}
              onChange={(e) => updateField("comment", e.target.value)}
              placeholder="Заметки о поставщике..."
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
  )
}
