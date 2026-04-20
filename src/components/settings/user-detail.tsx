"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Loader2, Plus, X, ArrowLeft } from "lucide-react"
import {
  updateUser,
  updateUserStores,
  updateUserRoles,
  toggleUserActive,
  resetUserPassword,
  getAllStores,
  getRoles,
} from "@/actions/settings"
import { toast } from "sonner"
import Link from "next/link"

interface UserData {
  id: string
  login: string
  firstName: string
  lastName: string
  phone: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  stores: { id: string; name: string }[]
  roles: {
    roleId: string
    roleName: string
    storeId: string | null
    storeName: string | null
  }[]
}

interface StoreOption {
  id: string
  name: string
}

interface RoleOption {
  id: string
  name: string
  description: string | null
  isSystem: boolean
}

interface RoleAssignment {
  roleId: string
  storeId: string
}

interface UserDetailProps {
  user: UserData
  canManage: boolean
  currentUserId: string
}

export function UserDetail({ user, canManage, currentUserId }: UserDetailProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Info form
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const [phone, setPhone] = useState(user.phone ?? "")
  const [login, setLogin] = useState(user.login)

  // Password reset
  const [newPassword, setNewPassword] = useState("")

  // Stores
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>(
    user.stores.map((s) => s.id)
  )

  // Roles
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>(
    user.roles.map((r) => ({
      roleId: r.roleId,
      storeId: r.storeId ?? "",
    }))
  )

  // Options
  const [allStores, setAllStores] = useState<StoreOption[]>([])
  const [allRoles, setAllRoles] = useState<RoleOption[]>([])

  useEffect(() => {
    Promise.all([getAllStores(), getRoles()]).then(([s, r]) => {
      setAllStores(s)
      setAllRoles(r)
    })
  }, [])

  const isSelf = user.id === currentUserId

  function handleUpdateInfo() {
    if (!firstName.trim()) {
      toast.error("Укажите имя")
      return
    }
    if (!lastName.trim()) {
      toast.error("Укажите фамилию")
      return
    }

    startTransition(async () => {
      try {
        await updateUser(user.id, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
          login: login.trim(),
        })
        toast.success("Данные обновлены")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка сохранения")
      }
    })
  }

  function handleResetPassword() {
    if (!newPassword || newPassword.length < 4) {
      toast.error("Пароль должен быть не менее 4 символов")
      return
    }

    startTransition(async () => {
      try {
        await resetUserPassword(user.id, newPassword)
        toast.success("Пароль сброшен")
        setNewPassword("")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка сброса пароля")
      }
    })
  }

  function toggleStore(storeId: string) {
    setSelectedStoreIds((prev) =>
      prev.includes(storeId)
        ? prev.filter((id) => id !== storeId)
        : [...prev, storeId]
    )
  }

  function handleSaveStores() {
    startTransition(async () => {
      try {
        await updateUserStores(user.id, selectedStoreIds)
        toast.success("Магазины обновлены")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка сохранения")
      }
    })
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

  function handleSaveRoles() {
    const validAssignments = roleAssignments.filter((a) => a.roleId)

    startTransition(async () => {
      try {
        await updateUserRoles(
          user.id,
          validAssignments.map((a) => ({
            roleId: a.roleId,
            storeId: a.storeId || undefined,
          }))
        )
        toast.success("Роли обновлены")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка сохранения")
      }
    })
  }

  function handleToggleActive() {
    startTransition(async () => {
      try {
        await toggleUserActive(user.id)
        toast.success(
          user.isActive
            ? "Пользователь деактивирован"
            : "Пользователь активирован"
        )
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка")
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/settings/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 size-4" />
            Назад
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {user.lastName} {user.firstName}
          </h1>
          <p className="text-muted-foreground">
            Логин: <span className="font-mono">{user.login}</span>
            {" | "}
            Создан: {new Date(user.createdAt).toLocaleDateString("ru-RU")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user.isActive ? (
            <Badge variant="default" className="bg-green-600">
              Активен
            </Badge>
          ) : (
            <Badge variant="secondary">Неактивен</Badge>
          )}
        </div>
      </div>

      {/* Info */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Личные данные</CardTitle>
            <CardDescription>Основная информация о пользователе</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 max-w-lg">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Фамилия *</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Имя *</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Логин</Label>
                  <Input
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Телефон</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 999 123-45-67"
                  />
                </div>
              </div>

              <div>
                <Button onClick={handleUpdateInfo} disabled={isPending}>
                  {isPending && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  Сохранить
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Password Reset */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Сброс пароля</CardTitle>
            <CardDescription>
              Установите новый пароль для пользователя
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4 max-w-lg">
              <div className="grid gap-2 flex-1">
                <Label>Новый пароль</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Мин. 4 символа"
                />
              </div>
              <Button onClick={handleResetPassword} disabled={isPending}>
                {isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Сбросить
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Store Assignments */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Магазины</CardTitle>
            <CardDescription>
              Выберите магазины, к которым имеет доступ пользователь
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 max-w-lg">
              <div className="space-y-2">
                {allStores.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`detail-store-${s.id}`}
                      checked={selectedStoreIds.includes(s.id)}
                      onCheckedChange={() => toggleStore(s.id)}
                    />
                    <Label
                      htmlFor={`detail-store-${s.id}`}
                      className="cursor-pointer font-normal"
                    >
                      {s.name}
                    </Label>
                  </div>
                ))}
              </div>
              <div>
                <Button onClick={handleSaveStores} disabled={isPending}>
                  {isPending && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  Сохранить магазины
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role Assignments */}
      {canManage && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Роли</CardTitle>
                <CardDescription>
                  Назначьте роли пользователю (глобально или для конкретного
                  магазина)
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addRoleAssignment}>
                <Plus className="mr-1 size-3" />
                Добавить
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 max-w-lg">
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
                      {allRoles.map((r) => (
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
                      <SelectItem value="__global__">Все магазины</SelectItem>
                      {allStores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRoleAssignment(index)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <div>
                <Button onClick={handleSaveRoles} disabled={isPending}>
                  {isPending && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  Сохранить роли
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toggle active */}
      {canManage && !isSelf && (
        <Card>
          <CardHeader>
            <CardTitle>Статус пользователя</CardTitle>
            <CardDescription>
              {user.isActive
                ? "Пользователь активен и может входить в систему"
                : "Пользователь деактивирован и не может входить в систему"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant={user.isActive ? "destructive" : "default"}
                  >
                    {user.isActive ? "Деактивировать" : "Активировать"}
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {user.isActive
                      ? "Деактивировать пользователя?"
                      : "Активировать пользователя?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {user.isActive
                      ? `${user.lastName} ${user.firstName} не сможет входить в систему.`
                      : `${user.lastName} ${user.firstName} снова сможет входить в систему.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={handleToggleActive}>
                    {user.isActive ? "Деактивировать" : "Активировать"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
