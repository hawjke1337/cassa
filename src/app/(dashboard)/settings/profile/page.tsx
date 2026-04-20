import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getProfile } from "@/actions/settings"
import { ProfileForm } from "@/components/settings/profile-form"
import { PasswordForm } from "@/components/settings/password-form"

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const profile = await getProfile()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Мой профиль</h1>
        <p className="text-muted-foreground">
          Управление личными данными и паролем
        </p>
      </div>

      <ProfileForm profile={profile} />
      <PasswordForm />
    </div>
  )
}
