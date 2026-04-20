"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { changePassword } from "@/actions/settings"
import { toast } from "sonner"

export function PasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  function handleSubmit() {
    if (!currentPassword) {
      toast.error("Укажите текущий пароль")
      return
    }
    if (!newPassword || newPassword.length < 4) {
      toast.error("Новый пароль должен быть не менее 4 символов")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Пароли не совпадают")
      return
    }

    startTransition(async () => {
      try {
        await changePassword({
          currentPassword,
          newPassword,
        })
        toast.success("Пароль изменён")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка смены пароля")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Смена пароля</CardTitle>
        <CardDescription>
          Введите текущий пароль и новый пароль
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 max-w-md">
          <div className="grid gap-2">
            <Label htmlFor="current-password">Текущий пароль</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-password">Новый пароль</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Мин. 4 символа"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Подтверждение пароля</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Изменить пароль
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
