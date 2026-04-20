import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { SettingsNav } from "@/components/settings/settings-nav"

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const permissions = session.user.permissions ?? []

  // At minimum, every user can see profile
  const hasAnySettingsAccess =
    permissions.includes("settings.stores") ||
    permissions.includes("settings.users") ||
    permissions.includes("settings.templates") ||
    true // profile is always visible

  if (!hasAnySettingsAccess) redirect("/")

  return (
    <div className="flex gap-6">
      <aside className="hidden w-56 shrink-0 md:block">
        <SettingsNav permissions={permissions} />
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
