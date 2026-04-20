"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createRepair, lookupDeviceByImei } from "@/actions/repairs"
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
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { formatDate } from "@/lib/format"

interface RepairFormProps {
  storeId: string
}

interface FormState {
  clientName: string
  clientPhone: string
  deviceType: string
  deviceBrand: string
  deviceModel: string
  deviceSerial: string
  deviceCondition: string
  devicePassword: string
  estimatedCost: string
  defectDescription: string
  comment: string
  deviceRecordId: string
  serialUnitId: string
}

const emptyForm: FormState = {
  clientName: "",
  clientPhone: "",
  deviceType: "",
  deviceBrand: "",
  deviceModel: "",
  deviceSerial: "",
  deviceCondition: "",
  devicePassword: "",
  estimatedCost: "",
  defectDescription: "",
  comment: "",
  deviceRecordId: "",
  serialUnitId: "",
}

export function RepairForm({ storeId }: RepairFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [deviceLookup, setDeviceLookup] = useState<Awaited<
    ReturnType<typeof lookupDeviceByImei>
  > | null>(null)
  const [lookingUp, setLookingUp] = useState(false)

  function resetForm() {
    setForm(emptyForm)
    setDeviceLookup(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      resetForm()
    }
  }

  function updateField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleDeviceLookup() {
    if (!form.deviceSerial.trim()) {
      setDeviceLookup(null)
      return
    }
    setLookingUp(true)
    try {
      const result = await lookupDeviceByImei(storeId, form.deviceSerial.trim())
      setDeviceLookup(result)
      if (result.type === "serialUnit") {
        setForm((prev) => ({ ...prev, serialUnitId: result.serialUnitId, deviceRecordId: "" }))
      } else if (result.type === "deviceRecord") {
        setForm((prev) => ({
          ...prev,
          deviceRecordId: result.deviceRecordId,
          serialUnitId: "",
          deviceType: prev.deviceType || result.deviceType || "",
          deviceBrand: prev.deviceBrand || result.brand || "",
          deviceModel: prev.deviceModel || result.model || "",
        }))
      } else {
        setForm((prev) => ({ ...prev, serialUnitId: "", deviceRecordId: "" }))
      }
    } catch {
      toast.error("Не удалось проверить устройство")
      setDeviceLookup(null)
    } finally {
      setLookingUp(false)
    }
  }

  function handleSubmit() {
    if (!form.clientName.trim()) {
      toast.error("Укажите имя клиента")
      return
    }
    if (!form.clientPhone.trim()) {
      toast.error("Укажите телефон клиента")
      return
    }
    if (!form.deviceType.trim()) {
      toast.error("Укажите тип устройства")
      return
    }
    if (!form.deviceCondition.trim()) {
      toast.error("Укажите состояние устройства")
      return
    }
    if (!form.defectDescription.trim()) {
      toast.error("Укажите описание неисправности")
      return
    }

    startTransition(async () => {
      try {
        const result = await createRepair({
          storeId,
          clientName: form.clientName,
          clientPhone: form.clientPhone,
          deviceType: form.deviceType,
          deviceBrand: form.deviceBrand || undefined,
          deviceModel: form.deviceModel || undefined,
          deviceSerial: form.deviceSerial || undefined,
          deviceCondition: form.deviceCondition,
          devicePassword: form.devicePassword || undefined,
          defectDescription: form.defectDescription,
          estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
          comment: form.comment || undefined,
          deviceRecordId: form.deviceRecordId || undefined,
          serialUnitId: form.serialUnitId || undefined,
        })
        toast.success(`Ремонт ${result.number} создан`)
        setOpen(false)
        router.push(`/repairs/${result.id}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка создания ремонта")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="mr-2 size-4" />
            Принять устройство
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Приём устройства в ремонт</DialogTitle>
          <DialogDescription>Заполните информацию о клиенте и устройстве</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          {/* clientName */}
          <div className="grid gap-2">
            <Label htmlFor="repair-clientName">Имя клиента *</Label>
            <Input
              id="repair-clientName"
              value={form.clientName}
              onChange={(e) => updateField("clientName", e.target.value)}
              placeholder="Иванов Иван"
            />
          </div>

          {/* clientPhone */}
          <div className="grid gap-2">
            <Label htmlFor="repair-clientPhone">Телефон *</Label>
            <Input
              id="repair-clientPhone"
              value={form.clientPhone}
              onChange={(e) => updateField("clientPhone", e.target.value)}
              placeholder="+7 999 123-45-67"
            />
          </div>

          {/* deviceType */}
          <div className="grid gap-2">
            <Label htmlFor="repair-deviceType">Тип устройства *</Label>
            <Input
              id="repair-deviceType"
              value={form.deviceType}
              onChange={(e) => updateField("deviceType", e.target.value)}
              placeholder="Смартфон, ноутбук..."
            />
          </div>

          {/* deviceBrand */}
          <div className="grid gap-2">
            <Label htmlFor="repair-deviceBrand">Марка</Label>
            <Input
              id="repair-deviceBrand"
              value={form.deviceBrand}
              onChange={(e) => updateField("deviceBrand", e.target.value)}
              placeholder="Apple, Samsung..."
            />
          </div>

          {/* deviceModel */}
          <div className="grid gap-2">
            <Label htmlFor="repair-deviceModel">Модель</Label>
            <Input
              id="repair-deviceModel"
              value={form.deviceModel}
              onChange={(e) => updateField("deviceModel", e.target.value)}
              placeholder="iPhone 15, Galaxy S24..."
            />
          </div>

          {/* deviceSerial */}
          <div className="grid gap-2">
            <Label htmlFor="repair-deviceSerial">Серийный номер / IMEI</Label>
            <Input
              id="repair-deviceSerial"
              value={form.deviceSerial}
              onChange={(e) => updateField("deviceSerial", e.target.value)}
              onBlur={handleDeviceLookup}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleDeviceLookup()
                }
              }}
              placeholder="SN или IMEI"
            />
            {lookingUp && <p className="text-xs text-muted-foreground">Поиск...</p>}
            {deviceLookup?.type === "serialUnit" && (
              <div className="rounded border border-green-200 bg-green-50 p-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-400">
                Наш товар — {deviceLookup.productName}
                {deviceLookup.saleDate && `, продан ${formatDate(deviceLookup.saleDate)}`}
                {deviceLookup.warrantyUntil &&
                  (deviceLookup.isUnderWarranty
                    ? `, гарантия до ${formatDate(deviceLookup.warrantyUntil)}`
                    : `, гарантия истекла`)}
              </div>
            )}
            {deviceLookup?.type === "deviceRecord" && (
              <div className="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-400">
                Ранее в ремонте
                {deviceLookup.lastRepairNumber && ` — заказ ${deviceLookup.lastRepairNumber}`}
                {deviceLookup.lastRepairDate && ` от ${formatDate(deviceLookup.lastRepairDate)}`}
              </div>
            )}
            {deviceLookup?.type === "new" && (
              <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                Новое устройство
              </div>
            )}
          </div>

          {/* deviceCondition — col-span-2 */}
          <div className="col-span-2 grid gap-2">
            <Label htmlFor="repair-deviceCondition">Состояние устройства *</Label>
            <Textarea
              id="repair-deviceCondition"
              value={form.deviceCondition}
              onChange={(e) => updateField("deviceCondition", e.target.value)}
              placeholder="Царапины, трещины, комплектация..."
              rows={2}
            />
          </div>

          {/* devicePassword */}
          <div className="grid gap-2">
            <Label htmlFor="repair-devicePassword">Пароль устройства</Label>
            <Input
              id="repair-devicePassword"
              type="password"
              value={form.devicePassword}
              onChange={(e) => updateField("devicePassword", e.target.value)}
              placeholder="PIN или пароль"
            />
          </div>

          {/* estimatedCost */}
          <div className="grid gap-2">
            <Label htmlFor="repair-estimatedCost">Предварительная стоимость</Label>
            <Input
              id="repair-estimatedCost"
              type="number"
              value={form.estimatedCost}
              onChange={(e) => updateField("estimatedCost", e.target.value)}
              placeholder="0"
            />
          </div>

          {/* defectDescription — col-span-2 */}
          <div className="col-span-2 grid gap-2">
            <Label htmlFor="repair-defectDescription">Описание неисправности *</Label>
            <Textarea
              id="repair-defectDescription"
              value={form.defectDescription}
              onChange={(e) => updateField("defectDescription", e.target.value)}
              placeholder="Что не работает, при каких условиях возникает проблема..."
              rows={3}
            />
          </div>

          {/* comment — col-span-2 */}
          <div className="col-span-2 grid gap-2">
            <Label htmlFor="repair-comment">Комментарий</Label>
            <Textarea
              id="repair-comment"
              value={form.comment}
              onChange={(e) => updateField("comment", e.target.value)}
              placeholder="Дополнительные заметки..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Принять
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
