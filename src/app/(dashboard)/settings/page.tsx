import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const permissions = session.user.permissions ?? []

  // Redirect to first available settings tab
  if (permissions.includes("settings.stores")) {
    redirect("/settings/stores")
  }
  if (permissions.includes("settings.users")) {
    redirect("/settings/users")
  }

  // Default: profile
  redirect("/settings/profile")
}
