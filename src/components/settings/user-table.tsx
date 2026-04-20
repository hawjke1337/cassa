"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Power,
} from "lucide-react"
import { Input } from "@/components/ui/input"
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
import { getUsers, toggleUserActive } from "@/actions/settings"
import { toast } from "sonner"

interface UserRow {
  id: string
  login: string
  firstName: string
  lastName: string
  phone: string | null
  isActive: boolean
  stores: { id: string; name: string }[]
  roles: { roleId: string; roleName: string; storeId: string | null; storeName: string | null }[]
}

interface UserTableProps {
  canManage: boolean
  currentUserId: string
}

export function UserTable({ canManage, currentUserId }: UserTableProps) {
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)

  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [showActiveOnly, setShowActiveOnly] = useState(true)

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    startTransition(async () => {
      try {
        const result = await getUsers({
          search: search || undefined,
          isActive: showActiveOnly ? true : undefined,
          page,
          perPage: 20,
        })
        setUsers(result.users)
        setTotal(result.total)
        setTotalPages(result.totalPages)
      } finally {
        setIsLoading(false)
      }
    })
  }, [search, showActiveOnly, page])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    setPage(1)
  }, [search, showActiveOnly])

  async function handleToggleActive(userId: string, currentlyActive: boolean) {
    try {
      await toggleUserActive(userId)
      toast.success(
        currentlyActive ? "Пользователь деактивирован" : "Пользователь активирован"
      )
      loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка")
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени, логину, телефону..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant={showActiveOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowActiveOnly(!showActiveOnly)}
        >
          {showActiveOnly ? "Только активные" : "Все"}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Логин</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Магазины</TableHead>
              <TableHead>Роли</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  {search ? "Пользователи не найдены" : "Нет пользователей"}
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link
                      href={`/settings/users/${u.id}`}
                      className="font-medium hover:underline"
                    >
                      {u.lastName} {u.firstName}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {u.login}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.phone ?? "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.stores.length === 0 ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        u.stores.map((s) => (
                          <Badge key={s.id} variant="outline" className="text-xs">
                            {s.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        u.roles.map((r, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {r.roleName}
                            {r.storeName ? ` (${r.storeName})` : ""}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.isActive ? (
                      <Badge variant="default" className="bg-green-600">
                        Активен
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Неактивен</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/settings/users/${u.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                        >
                          <Eye className="size-4" />
                        </Button>
                      </Link>
                      {canManage && u.id !== currentUserId && (
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
                                {u.isActive
                                  ? "Деактивировать пользователя?"
                                  : "Активировать пользователя?"}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {u.isActive
                                  ? `${u.lastName} ${u.firstName} не сможет входить в систему.`
                                  : `${u.lastName} ${u.firstName} снова сможет входить в систему.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Отмена</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleToggleActive(u.id, u.isActive)
                                }
                              >
                                {u.isActive ? "Деактивировать" : "Активировать"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Всего: {total}</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isPending}
            >
              <ChevronLeft className="size-4" />
              Назад
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isPending}
            >
              Далее
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
