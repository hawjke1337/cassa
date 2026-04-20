"use client"

import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, X } from "lucide-react"
import { createUser, getAllStores, getRoles } from "@/actions/settings"
import { toast } from "sonner"

interface RoleOption {
  id: string
  name: string
  description: string | null
  isSystem: boolean
}

interface StoreOption {
  id: string
  name: string
}

interface RoleAssignment {
  roleId: string
  storeId: string // "" means global
}

interface UserFormProps {
  trigger: React.ReactNode
  onSuccess?: () => void
}

export function UserForm({ trigger, onSuccess }: UserFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([])
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([])

  const [stores, setStores] = useState<StoreOption[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])

  useEffect(() => {
    if (open) {
      Promise.all([getAllStores(), getRoles()]).then(([s, r]) => {
        setStores(s)
        setRoles(r)
      })
    }
  }, [open])

  function resetForm() {
    setLogin("")
    setPassword("")
    setFirstName("")
    setLastName("")
    setPhone("")
    setSelectedStoreIds([])
    setRoleAssignments([])
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) resetForm()
  }

  function toggleStore(storeId: string) {
    setSelectedStoreIds((prev) =>
      prev.includes(storeId)
        ? prev.filter((id) => id !== storeId)
        : [...prev, storeId]
    )
  }

  function addRoleAssignment() {
    setRoleAssignments((prev) => [...prev, { roleId: "", storeId: "" }])
  }

  function removeRoleAssignment(index: number) {
    setRoleAssignments((prev) => prev.filter((_, i) => i !== index))
  }

  function updateRoleAssignment(
    index: number,
    field: keyof RoleAssignment,
    value: string
  ) {
    setRoleAssignments((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    )
  }

  function handleSubmit() {
    if (!login.trim()) {
      toast.error("Укажите логин")
      return
    }
    if (!password || password.length < 4) {
      toast.error("Пароль должен быть не менее 4 символов")
      return
    }
    if (!firstName.trim()) {
      toast.error("Укажите имя")
      return
    }
    if (!lastName.trim()) {
      toast.error("Укажите фамилию")
      return
    }

    const validAssignments = roleAssignments.filter((a) => a.roleId)

    startTransition(async () => {
      try {
        await createUser({
          login: login.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
          storeIds: selectedStoreIds,
          roleAssignments: validAssignments.map((a) => ({
            roleId: a.roleId,
            storeId: a.storeId || undefined,
          })),
        })
        toast.success("Пользователь создан")
        setOpen(false)
        onSuccess?.()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка создания")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новый пользователь</DialogTitle>
          <DialogDescription>
            Создайте учётную запись и назначьте магазины и роли
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Login & Password */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="user-login">Логин *</Label>
              <Input
                id="user-login"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="ivanov"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-password">Пароль *</Label>
              <Input
                id="user-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Мин. 4 символа"
              />
            </div>
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="user-last-name">Фамилия *</Label>
              <Input
                id="user-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Иванов"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-first-name">Имя *</Label>
              <Input
                id="user-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Иван"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="grid gap-2">
            <Label htmlFor="user-phone">Телефон</Label>
            <Input
              id="user-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 999 123-45-67"
            />
          </div>

          {/* Stores */}
          <div className="grid gap-2">
            <Label>Магазины</Label>
            <div className="space-y-2 rounded-md border p-3">
              {stores.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Нет доступных магазинов
                </p>
              ) : (
                stores.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`store-${s.id}`}
                      checked={selectedStoreIds.includes(s.id)}
                      onCheckedChange={() => toggleStore(s.id)}
                    />
                    <Label
                      htmlFor={`store-${s.id}`}
                      className="cursor-pointer font-normal"
                    >
                      {s.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Role Assignments */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Роли</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRoleAssignment}
              >
                <Plus className="mr-1 size-3" />
                Добавить роль
              </Button>
            </div>
            <div className="space-y-2">
              {roleAssignments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Роли не назначены
                </p>
              )}
              {roleAssignments.map((assignment, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={assignment.roleId}
                    onValueChange={(v) =>
                      updateRoleAssignment(index, "roleId", v ?? "")
                    }
>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Выберите роль" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={assignment.storeId || "__global__"}
                    onValueChange={(v) =>
                      updateRoleAssignment(
                        index,
                        "storeId",
                        v === "__global__" ? "" : (v ?? "")
                      )
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Область" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__global__">
                        Все магазины
                      </SelectItem>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRoleAssignment(index)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
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
  )
}
