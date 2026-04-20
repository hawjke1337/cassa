"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Search } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ImeiSearchDialog } from "@/components/serial/imei-search-dialog"

const pageTitles: Record<string, string> = {
  "/": "Главная",
  "/pos": "Касса",
  "/catalog": "Каталог",
  "/inventory": "Склад",
  "/orders": "Заказы",
  "/suppliers": "Поставщики",
  "/customers": "Клиенты",
  "/repairs": "Ремонты",
  "/shifts": "Смены",
  "/trade-in": "Trade-in",
  "/warranty": "Гарантия",
  "/motivation": "Мотивация",
  "/reports": "Отчёты",
  "/settings": "Настройки",
  "/my": "Профиль",
}

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]

  // Match on first segment for nested routes
  const segment = "/" + pathname.split("/").filter(Boolean)[0]
  return pageTitles[segment] ?? "a:store"
}

export function Header() {
  const pathname = usePathname()
  const title = getPageTitle(pathname)
  const [imeiDialogOpen, setImeiDialogOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setImeiDialogOpen(true)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 !h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto">
        <Tooltip>
          <TooltipTrigger
            onClick={() => setImeiDialogOpen(true)}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Поиск по IMEI / SN"
          >
            <Search className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Поиск по IMEI / SN (⌘K)</TooltipContent>
        </Tooltip>
      </div>

      <ImeiSearchDialog open={imeiDialogOpen} onOpenChange={setImeiDialogOpen} />
    </header>
  )
}
