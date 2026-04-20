"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Receipt,
  Package,
  ClipboardList,
  Truck,
  BarChart3,
  Settings,
  Wrench,
  Award,
  Users,
  Repeat,
  Clock,
  ShieldCheck,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { StoreSwitcher } from "@/components/layout/store-switcher"
import { UserMenu } from "@/components/layout/user-menu"

interface StoreItem {
  id: string
  name: string
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  requiredPermissions?: string[]
  badge?: number
}

const navItems: NavItem[] = [
  {
    title: "Главная",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Касса",
    href: "/pos",
    icon: Receipt,
    requiredPermissions: ["pos.sell"],
  },
  {
    // UX2-16: Объединённый пункт "Товары" = Каталог + Склад (tabs внутри /products).
    title: "Товары",
    href: "/products",
    icon: Package,
    requiredPermissions: ["catalog.view", "inventory.view"],
  },
  {
    title: "Заказы",
    href: "/orders",
    icon: ClipboardList,
    requiredPermissions: ["orders.view"],
  },
  {
    title: "Ремонт",
    href: "/repairs",
    icon: Wrench,
    requiredPermissions: ["repairs.view"],
  },
  {
    title: "Гарантия",
    href: "/warranty",
    icon: ShieldCheck,
    requiredPermissions: ["warranty.view"],
  },
  {
    title: "Клиенты",
    href: "/customers",
    icon: Users,
    requiredPermissions: ["customers.view"],
  },
  {
    title: "Трейд-ин",
    href: "/trade-in",
    icon: Repeat,
    requiredPermissions: ["tradein.view"],
  },
  {
    title: "Смены",
    href: "/shifts",
    icon: Clock,
    requiredPermissions: ["shifts.view"],
  },
  {
    title: "Поставщики",
    href: "/suppliers",
    icon: Truck,
    requiredPermissions: ["suppliers.view"],
  },
  {
    title: "Долги",
    href: "/suppliers/debts",
    icon: Receipt,
    requiredPermissions: ["orders.costs"],
  },
  {
    title: "Мотивация",
    href: "/motivation",
    icon: Award,
    requiredPermissions: ["motivation.payroll.own"],
  },
  {
    title: "Отчёты",
    href: "/reports",
    icon: BarChart3,
    requiredPermissions: ["reports.sales"],
  },
  {
    title: "Настройки",
    href: "/settings",
    icon: Settings,
    requiredPermissions: ["settings.users", "settings.roles", "settings.stores"],
  },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: {
    name: string
    login: string
    roles: string[]
    permissions: string[]
  }
  stores: StoreItem[]
  pendingSchemeCount?: number
}

function hasAccess(userPermissions: string[], requiredPermissions?: string[]): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) return true
  // User needs at least one of the required permissions
  return requiredPermissions.some((perm) => userPermissions.includes(perm))
}

export function AppSidebar({ user, stores, pendingSchemeCount = 0, ...props }: AppSidebarProps) {
  const pathname = usePathname()

  // Force remount after hydration to fix base-ui useId() SSR mismatch
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  const itemsWithBadges = navItems.map((item) =>
    item.href === "/motivation" && pendingSchemeCount > 0
      ? { ...item, badge: pendingSchemeCount }
      : item,
  )

  const visibleItems = itemsWithBadges.filter((item) =>
    hasAccess(user.permissions, item.requiredPermissions),
  )

  return (
    <Sidebar key={hydrated ? "h" : "i"} collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <StoreSwitcher stores={stores} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      tooltip={item.title}
                      isActive={isActive}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                      {item.badge && (
                        <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                          {item.badge}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu user={user} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
