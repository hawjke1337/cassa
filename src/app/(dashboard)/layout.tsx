import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Header } from "@/components/layout/header"
import { getPendingSchemeCount } from "@/actions/motivation-schemes"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const userStores = await db.userStore.findMany({
    where: { userId: session.user.id },
    include: { store: { select: { id: true, name: true } } },
  })

  const stores = userStores.map((us) => ({
    id: us.store.id,
    name: us.store.name,
  }))

  const user = {
    name: session.user.name,
    login: session.user.login,
    roles: session.user.roles,
    permissions: session.user.permissions,
  }
  const pendingSchemeCount = await getPendingSchemeCount()

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={user} stores={stores} pendingSchemeCount={pendingSchemeCount} />
        <SidebarInset>
          <Header />
          <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
