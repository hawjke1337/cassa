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
import { createRole, updateRole } from "@/actions/roles"
import { PermissionMatrix } from "@/components/settings/permission-matrix"
import { toast } from "sonner"

interface RoleFormProps {
  trigger: React.ReactNode
  role?: {
    id: string
    name: string
    description: string | null
    permissionCodes: string[]
    isSystem?: boolean
  }
  modules: {
    module: string
    moduleName: string
    permissions: { id: string; code: string; name: string }[]
  }[]
}

export function RoleForm({ trigger, role, modules }: RoleFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(role?.name ?? "")
  const [description, setDescription] = useState(role?.description ?? "")
  const [selectedCodes, setSelectedCodes] = useState<string[]>(role?.permissionCodes ?? [])

  const isEdit = !!role
  const isSystem = role?.isSystem ?? false

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setName(role?.name ?? "")
      setDescription(role?.description ?? "")
      setSelectedCodes(role?.permissionCodes ?? [])
    }
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Укажите название роли")
      return
    }
    if (name.trim().length > 100) {
      toast.error("Название роли не может быть длиннее 100 символов")
      return
    }

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateRole(role.id, {
            name: name.trim(),
            description: description.trim() || undefined,
            permissionCodes: selectedCodes,
          })
          toast.success("Роль обновлена")
        } else {
          await createRole({
            name: name.trim(),
            description: description.trim() || undefined,
            permissionCodes: selectedCodes,
          })
          toast.success("Роль создана")
        }
        setOpen(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка сохранения")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Редактирование роли${isSystem ? ` «${role?.name}»` : ""}` : "Новая роль"}
          </DialogTitle>
          <DialogDescription>
            {isSystem
              ? "Настройте права доступа для системной роли"
              : isEdit
                ? "Измените название, описание и права доступа"
                : "Создайте роль и настройте права доступа"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="role-name">Название *</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Старший продавец"
              maxLength={100}
              disabled={isSystem}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role-description">Описание</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание роли..."
              rows={2}
              disabled={isSystem}
            />
          </div>

          <div className="grid gap-2">
            <Label>Права доступа ({selectedCodes.length} выбрано)</Label>
            <PermissionMatrix
              modules={modules}
              selectedCodes={selectedCodes}
              onChange={setSelectedCodes}
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
