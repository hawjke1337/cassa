"use client"

import { useEffect } from "react"
import { ChevronsUpDown, Store } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar"
import { useCurrentStore } from "@/hooks/use-current-store"

interface StoreItem {
  id: string
  name: string
}

interface StoreSwitcherProps {
  stores: StoreItem[]
}

export function StoreSwitcher({ stores }: StoreSwitcherProps) {
  const { isMobile } = useSidebar()
  const { currentStoreId, currentStoreName, setCurrentStore } = useCurrentStore()

  // Auto-select first store if nothing is selected or selected store not available
  useEffect(() => {
    if (stores.length === 0) return

    const storeExists = stores.some((s) => s.id === currentStoreId)
    if (!currentStoreId || !storeExists) {
      setCurrentStore(stores[0].id, stores[0].name)
    }
  }, [stores, currentStoreId, setCurrentStore])

  if (stores.length === 0) {
    return (
      <SidebarMenuButton size="lg" className="cursor-default">
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted">
          <Store className="size-4 text-muted-foreground" />
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate text-xs text-muted-foreground">Нет магазинов</span>
        </div>
      </SidebarMenuButton>
    )
  }

  // Single store — just show the name, no dropdown
  if (stores.length === 1) {
    return (
      <SidebarMenuButton size="lg" className="cursor-default">
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Store className="size-4" />
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">{stores[0].name}</span>
          <span className="truncate text-xs text-muted-foreground">Магазин</span>
        </div>
      </SidebarMenuButton>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
          />
        }
      >
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Store className="size-4" />
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">{currentStoreName ?? "Выберите магазин"}</span>
          <span className="truncate text-xs text-muted-foreground">Магазин</span>
        </div>
        <ChevronsUpDown className="ml-auto" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--anchor-width] min-w-56 rounded-lg"
        align="start"
        side={isMobile ? "bottom" : "right"}
        sideOffset={4}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Магазины</DropdownMenuLabel>
        </DropdownMenuGroup>
        {stores.map((store) => (
          <DropdownMenuItem
            key={store.id}
            onClick={() => setCurrentStore(store.id, store.name)}
            className="gap-2 p-2"
          >
            <div className="flex size-6 items-center justify-center rounded-sm border">
              <Store className="size-4 shrink-0" />
            </div>
            {store.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
