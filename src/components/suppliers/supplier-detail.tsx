"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Globe,
  Phone,
  Mail,
  MapPin,
  Building,
  User,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { getSupplier, deleteSupplier } from "@/actions/suppliers"
import { SupplierForm } from "@/components/suppliers/supplier-form"
import { DebtPaymentDialog } from "@/components/suppliers/debt-payment-dialog"
import { formatMoney, formatDate } from "@/lib/format"
import { toast } from "sonner"

type SupplierDetail = Awaited<ReturnType<typeof getSupplier>>

interface SupplierDetailProps {
  supplierId: string
  canEdit: boolean
}

export function SupplierDetail({ supplierId, canEdit }: SupplierDetailProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadSupplier = useCallback(async () => {
    setIsLoading(true)
    startTransition(async () => {
      try {
        const data = await getSupplier(supplierId)
        setSupplier(data)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка загрузки")
        router.push("/suppliers")
      } finally {
        setIsLoading(false)
      }
    })
  }, [supplierId, router])

  useEffect(() => {
    loadSupplier()
  }, [loadSupplier])

  async function handleDelete() {
    try {
      const result = await deleteSupplier(supplierId)
      if (result.deleted) {
        toast.success("Поставщик удалён")
      } else {
        toast.success("Поставщик деактивирован")
      }
      router.push("/suppliers")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка удаления")
    }
  }

  if (isLoading || !supplier) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  function statusBadge(status: string) {
    switch (status) {
      case "DRAFT":
        return <Badge variant="outline">Черновик</Badge>
      case "CONFIRMED":
        return (
          <Badge variant="default" className="bg-green-600">
            Подтверждён
          </Badge>
        )
      case "CANCELLED":
        return <Badge variant="destructive">Отменён</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/suppliers">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{supplier.name}</h1>
              {supplier.isActive ? (
                <Badge variant="default" className="bg-green-600">
                  Активен
                </Badge>
              ) : (
                <Badge variant="secondary">Неактивен</Badge>
              )}
            </div>
            {supplier.inn && <p className="text-sm text-muted-foreground">ИНН: {supplier.inn}</p>}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <SupplierForm
              supplier={{
                id: supplier.id,
                name: supplier.name,
                contactName: supplier.contactName ?? "",
                phone: supplier.phone ?? "",
                email: supplier.email ?? "",
                website: supplier.website ?? "",
                city: supplier.city ?? "",
                address: supplier.address ?? "",
                inn: supplier.inn ?? "",
                comment: supplier.comment ?? "",
              }}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil className="size-4" />
                  Редактировать
                </Button>
              }
              onSuccess={loadSupplier}
            />
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="outline" size="sm">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить поставщика?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Если у поставщика есть связанные документы, он будет деактивирован.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact info */}
        <Card>
          <CardHeader>
            <CardTitle>Контактные данные</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {supplier.contactName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="size-4 text-muted-foreground" />
                <span>{supplier.contactName}</span>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="size-4 text-muted-foreground" />
                <a href={`tel:${supplier.phone}`} className="hover:underline">
                  {supplier.phone}
                </a>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="size-4 text-muted-foreground" />
                <a href={`mailto:${supplier.email}`} className="hover:underline">
                  {supplier.email}
                </a>
              </div>
            )}
            {supplier.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="size-4 text-muted-foreground" />
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {supplier.website}
                </a>
              </div>
            )}
            {supplier.city && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="size-4 text-muted-foreground" />
                <span>{supplier.city}</span>
              </div>
            )}
            {supplier.address && (
              <div className="flex items-center gap-2 text-sm">
                <Building className="size-4 text-muted-foreground" />
                <span>{supplier.address}</span>
              </div>
            )}
            {supplier.comment && (
              <div className="flex items-start gap-2 text-sm">
                <FileText className="mt-0.5 size-4 text-muted-foreground" />
                <span className="text-muted-foreground">{supplier.comment}</span>
              </div>
            )}
            {!supplier.contactName &&
              !supplier.phone &&
              !supplier.email &&
              !supplier.website &&
              !supplier.city &&
              !supplier.address &&
              !supplier.comment && (
                <p className="text-sm text-muted-foreground">Нет контактных данных</p>
              )}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Статистика</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">{supplier.stats.receivesCount}</p>
                <p className="text-sm text-muted-foreground">Приходов</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">{formatMoney(supplier.stats.totalAmount)}</p>
                <p className="text-sm text-muted-foreground">Общая сумма</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">{supplier.stats.ordersCount}</p>
                <p className="text-sm text-muted-foreground">Заказов</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-sm text-muted-foreground">Добавлен</p>
                <p className="text-sm font-medium">{formatDate(supplier.createdAt)}</p>
              </div>
              {supplier.unpaidDebtsCount > 0 && (
                <div className="rounded-lg border border-destructive/50 p-4 text-center col-span-2">
                  <p className="text-2xl font-bold text-destructive">
                    {formatMoney(supplier.unpaidDebtTotal)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Неоплаченные долги ({supplier.unpaidDebtsCount})
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent receives */}
      <Card>
        <CardHeader>
          <CardTitle>Последние приходы</CardTitle>
        </CardHeader>
        <CardContent>
          {supplier.recentReceives.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Нет документов прихода от этого поставщика
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Номер</TableHead>
                    <TableHead>Магазин</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.recentReceives.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.number}</TableCell>
                      <TableCell>{r.storeName}</TableCell>
                      <TableCell>{formatMoney(r.totalAmount)}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell>{formatDate(r.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debts with payment buttons */}
      {supplier.debts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Долги</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Заказ</TableHead>
                    <TableHead>Сумма долга</TableHead>
                    <TableHead>Оплачено</TableHead>
                    <TableHead>Остаток</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.debts.map((d) => {
                    const remaining = parseFloat(d.amount) - parseFloat(d.totalPaid)
                    return (
                      <TableRow key={d.id}>
                        <TableCell>
                          <Link
                            href={`/orders/${d.orderId}`}
                            className="font-mono text-sm text-primary hover:underline"
                          >
                            {d.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatMoney(parseFloat(d.amount))}
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatMoney(parseFloat(d.totalPaid))}
                        </TableCell>
                        <TableCell className="font-mono">{formatMoney(remaining)}</TableCell>
                        <TableCell>
                          {d.isPaid ? (
                            <Badge variant="default" className="bg-green-600">
                              Оплачен
                            </Badge>
                          ) : parseFloat(d.totalPaid) > 0 ? (
                            <Badge variant="secondary">Частично</Badge>
                          ) : (
                            <Badge variant="destructive">Не оплачен</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!d.isPaid && canEdit && (
                            <DebtPaymentDialog
                              debtId={d.id}
                              debtAmount={d.amount}
                              totalPaid={d.totalPaid}
                              orderNumber={d.orderNumber}
                              onSuccess={loadSupplier}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment history */}
      <Card>
        <CardHeader>
          <CardTitle>История платежей</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const allPayments = supplier.debts.flatMap((d) =>
              d.payments.map((p) => ({
                ...p,
                orderNumber: d.orderNumber,
                orderId: d.orderId,
              })),
            )
            if (allPayments.length === 0) {
              return <p className="py-4 text-center text-sm text-muted-foreground">Нет платежей</p>
            }
            // Sort by paidAt descending
            allPayments.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
            return (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>Сумма</TableHead>
                      <TableHead>Заказ #</TableHead>
                      <TableHead>Комментарий</TableHead>
                      <TableHead>Оператор</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{formatDate(p.paidAt)}</TableCell>
                        <TableCell className="font-mono">{formatMoney(p.amount)}</TableCell>
                        <TableCell>
                          <Link
                            href={`/orders/${p.orderId}`}
                            className="font-mono text-sm text-primary hover:underline"
                          >
                            {p.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.comment || "---"}
                        </TableCell>
                        <TableCell className="text-sm">{p.userName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          })()}
        </CardContent>
      </Card>
    </div>
  )
}
