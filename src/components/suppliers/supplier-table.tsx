"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Search, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Eye } from "lucide-react"
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
import { getSuppliers, deleteSupplier } from "@/actions/suppliers"
import { SupplierForm } from "@/components/suppliers/supplier-form"
import { toast } from "sonner"

interface SupplierRow {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  city: string | null
  inn: string | null
  isActive: boolean
}

interface SupplierTableProps {
  canEdit: boolean
}

export function SupplierTable({ canEdit }: SupplierTableProps) {
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)

  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [showActiveOnly, setShowActiveOnly] = useState(true)

  const loadSuppliers = useCallback(async () => {
    setIsLoading(true)
    startTransition(async () => {
      try {
        const result = await getSuppliers({
          search: search || undefined,
          isActive: showActiveOnly ? true : undefined,
          page,
          perPage: 20,
        })
        setSuppliers(result.suppliers)
        setTotal(result.total)
        setTotalPages(result.totalPages)
      } finally {
        setIsLoading(false)
      }
    })
  }, [search, showActiveOnly, page])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  useEffect(() => {
    setPage(1)
  }, [search, showActiveOnly])

  async function handleDelete(id: string) {
    try {
      const result = await deleteSupplier(id)
      if (result.deleted) {
        toast.success("Поставщик удалён")
      } else {
        toast.success("Поставщик деактивирован (есть связанные документы)")
      }
      loadSuppliers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка удаления")
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию, ИНН, городу..."
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
              <TableHead>Название</TableHead>
              <TableHead>Контакт</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Город</TableHead>
              <TableHead>ИНН</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {search ? "Поставщики не найдены" : "Нет поставщиков"}
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/suppliers/${s.id}`}
                      className="font-medium hover:underline"
                    >
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.contactName ?? "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.phone ?? "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.email ?? "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.city ?? "-"}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {s.inn ?? "-"}
                  </TableCell>
                  <TableCell>
                    {s.isActive ? (
                      <Badge variant="default" className="bg-green-600">Активен</Badge>
                    ) : (
                      <Badge variant="secondary">Неактивен</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/suppliers/${s.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                        >
                          <Eye className="size-4" />
                        </Button>
                      </Link>
                      {canEdit && (
                        <>
                          <SupplierForm
                            supplier={{
                              id: s.id,
                              name: s.name,
                              contactName: s.contactName ?? "",
                              phone: s.phone ?? "",
                              email: s.email ?? "",
                              website: "",
                              city: s.city ?? "",
                              address: "",
                              inn: s.inn ?? "",
                              comment: "",
                            }}
                            trigger={
                              <Button variant="ghost" size="sm">
                                <Pencil className="size-4" />
                              </Button>
                            }
                            onSuccess={loadSuppliers}
                          />
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
                                <AlertDialogTitle>Удалить поставщика?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Если у поставщика есть связанные документы, он будет деактивирован вместо удаления.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Отмена</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(s.id)}>
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
