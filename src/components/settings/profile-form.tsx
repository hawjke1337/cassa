"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { updateProfile } from "@/actions/settings"
import { toast } from "sonner"

interface ProfileFormProps {
  profile: {
    firstName: string
    lastName: string
    phone: string | null
    login: string
    createdAt: string
  }
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition()
  const [firstName, setFirstName] = useState(profile.firstName)
  const [lastName, setLastName] = useState(profile.lastName)
  const [phone, setPhone] = useState(profile.phone ?? "")

  function handleSubmit() {
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
        await updateProfile({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
        })
        toast.success("Профиль обновлён")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка сохранения")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Личные данные</CardTitle>
        <CardDescription>
          Логин: <span className="font-mono">{profile.login}</span> | Дата
          регистрации:{" "}
          {new Date(profile.createdAt).toLocaleDateString("ru-RU")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 max-w-md">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="profile-last-name">Фамилия *</Label>
              <Input
                id="profile-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-first-name">Имя *</Label>
              <Input
                id="profile-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-phone">Телефон</Label>
            <Input
              id="profile-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 999 123-45-67"
            />
          </div>

          <div>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Сохранить
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
