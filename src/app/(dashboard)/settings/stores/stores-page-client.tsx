"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Plus, Power, Trash2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { StoreForm } from "@/components/settings/store-form"
import { getStores, toggleStoreActive, softDeleteStore, restoreStore } from "@/actions/settings"
import { toast } from "sonner"

interface StoreRow {
  id: string
  name: string
  address: string
  phone: string | null
  isActive: boolean
  isDeleted: boolean
  userCount: number
}

export function StoresPageClient() {
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)
  const [stores, setStores] = useState<StoreRow[]>([])

  const loadStores = useCallback(async () => {
    setIsLoading(true)
    startTransition(async () => {
      try {
        const result = await getStores()
        setStores(result)
      } finally {
        setIsLoading(false)
      }
    })
  }, [])

  useEffect(() => {
    loadStores()
  }, [loadStores])

  async function handleToggleActive(storeId: string, currentlyActive: boolean) {
    try {
      await toggleStoreActive(storeId)
      toast.success(currentlyActive ? "Магазин деактивирован" : "Магазин активирован")
      loadStores()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Магазины</h1>
          <p className="text-muted-foreground">Управление торговыми точками</p>
        </div>
        <StoreForm
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              Добавить магазин
            </Button>
          }
          onSuccess={loadStores}
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Адрес</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Сотрудников</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : stores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Нет магазинов
                </TableCell>
              </TableRow>
            ) : (
              stores.map((s) => (
                <TableRow key={s.id} className={s.isDeleted ? "opacity-50" : ""}>
                  <TableCell className="font-medium">
                    {s.name}
                    {s.isDeleted && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Архивирован
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.address}</TableCell>
                  <TableCell className="text-muted-foreground">{s.phone ?? "-"}</TableCell>
                  <TableCell>{s.userCount}</TableCell>
                  <TableCell>
                    {s.isDeleted ? (
                      <Badge variant="secondary">Архивирован</Badge>
                    ) : s.isActive ? (
                      <Badge variant="default" className="bg-green-600">
                        Активен
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Неактивен</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {s.isDeleted ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              await restoreStore(s.id)
                              toast.success("Магазин восстановлен")
                              loadStores()
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Ошибка")
                            }
                          }}
                        >
                          <RotateCcw className="mr-1 size-3" />
                          Восстановить
                        </Button>
                      ) : (
                        <>
                          <StoreForm
                            store={{
                              id: s.id,
                              name: s.name,
                              address: s.address,
                              phone: s.phone ?? "",
                            }}
                            trigger={
                              <Button variant="ghost" size="sm">
                                Изменить
                              </Button>
                            }
                            onSuccess={loadStores}
                          />
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <Button variant="ghost" size="sm">
                                  <Power className="size-4 text-muted-foreground" />
                                </Button>
                              }
                            />
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {s.isActive ? "Деактивировать магазин?" : "Активировать магазин?"}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {s.isActive
                                    ? `Магазин "${s.name}" будет деактивирован.`
                                    : `Магазин "${s.name}" будет активирован.`}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Отмена</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleToggleActive(s.id, s.isActive)}
                                >
                                  {s.isActive ? "Деактивировать" : "Активировать"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="size-4 text-destructive" />
                                </Button>
                              }
                            />
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Удалить магазин &laquo;{s.name}&raquo;?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Магазин будет помечен как архивный. Данные сохранятся. Удаление
                                  невозможно, если на складе есть остатки, открыта смена или есть
                                  активные заказы.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Отмена</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={async () => {
                                    try {
                                      await softDeleteStore(s.id)
                                      toast.success("Магазин архивирован")
                                      loadStores()
                                    } catch (err) {
                                      toast.error(
                                        err instanceof Error ? err.message : "Ошибка удаления",
                                      )
                                    }
                                  }}
                                >
                                  Удалить
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
