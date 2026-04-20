"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Store,
  Users,
  UserCircle,
  Tag,
  FileText,
  FolderTree,
  Calculator,
  Wallet,
  Percent,
  ScrollText,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface SettingsNavProps {
  permissions: string[]
}

export function SettingsNav({ permissions }: SettingsNavProps) {
  const pathname = usePathname()

  const items: NavItem[] = []

  if (permissions.includes("settings.stores")) {
    items.push({
      title: "Магазины",
      href: "/settings/stores",
      icon: Store,
    })
  }

  if (permissions.includes("settings.users")) {
    items.push({
      title: "Пользователи",
      href: "/settings/users",
      icon: Users,
    })
  }

  if (permissions.includes("settings.roles")) {
    items.push({
      title: "Роли",
      href: "/settings/roles",
      icon: Shield,
    })
  }

  if (permissions.includes("settings.templates")) {
    items.push({
      title: "Ценники",
      href: "/settings/price-labels",
      icon: Tag,
    })
    items.push({
      title: "Документы",
      href: "/settings/document-templates",
      icon: FileText,
    })
  }

  if (permissions.includes("motivation.groups.manage")) {
    items.push({
      title: "Мотивационные группы",
      href: "/settings/motivation-groups",
      icon: FolderTree,
    })
  }

  if (permissions.includes("motivation.schemes.manage")) {
    items.push({
      title: "Схемы мотивации",
      href: "/settings/motivation-schemes",
      icon: Calculator,
    })
  }

  if (permissions.includes("settings.stores")) {
    items.push({
      title: "Комиссии",
      href: "/settings/fees",
      icon: Percent,
    })
  }

  if (permissions.includes("funds.manage")) {
    items.push({
      title: "Фонды",
      href: "/settings/funds",
      icon: Wallet,
    })
  }

  if (permissions.includes("settings.stores")) {
    items.push({
      title: "Журнал аудита",
      href: "/settings/audit-log",
      icon: ScrollText,
    })
  }

  items.push({
    title: "Мой профиль",
    href: "/settings/profile",
    icon: UserCircle,
  })

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href)
        return (
          <Link key={item.href} href={item.href}>
            <Button
              variant={isActive ? "secondary" : "ghost"}
              className={cn("w-full justify-start", isActive && "bg-muted")}
            >
              <item.icon className="mr-2 size-4" />
              {item.title}
            </Button>
          </Link>
        )
      })}
    </nav>
  )
}
