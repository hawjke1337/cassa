"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"
import { useReactTable, getCoreRowModel, type ColumnDef, flexRender } from "@tanstack/react-table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getStock } from "@/actions/inventory"
import { getCategories } from "@/actions/catalog"
import { useCurrentStore } from "@/hooks/use-current-store"
import { formatMoney } from "@/lib/format"

interface StockRow {
  id: string
  productId: string
  name: string
  sku: string
  barcode: string | null
  unit: string
  categoryName: string
  categoryId: string
  isSerialized: boolean
  quantity: number
  minQty: number
  sellPrice: number
  costPrice: number | null
}

interface StockOverviewClientProps {
  canSeePrices: boolean
}

export function StockOverviewClient({ canSeePrices }: StockOverviewClientProps) {
  const { currentStoreId } = useCurrentStore()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)

  const [items, setItems] = useState<StockRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const perPage = 20

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [categoryId, setCategoryId] = useState<string>("")
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    getCategories().then(setCategories)
  }, [])

  // Debounce search input (300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const loadStock = useCallback(async () => {
    if (!currentStoreId) return
    setIsLoading(true)
    startTransition(async () => {
      try {
        const result = await getStock(currentStoreId, {
          search: debouncedSearch || undefined,
          categoryId: categoryId || undefined,
          page,
          perPage,
        })
        setItems(result.items)
        setTotal(result.total)
        setTotalPages(result.totalPages)
      } finally {
        setIsLoading(false)
      }
    })
  }, [currentStoreId, debouncedSearch, categoryId, page])

  useEffect(() => {
    loadStock()
  }, [loadStock])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, categoryId])

  if (!currentStoreId) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Выберите магазин для просмотра остатков
      </div>
    )
  }

  const columns: ColumnDef<StockRow>[] = [
    {
      accessorKey: "name",
      header: "Товар",
      cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
    },
    {
      accessorKey: "sku",
      header: "Артикул",
    },
    {
      accessorKey: "categoryName",
      header: "Категория",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <span>{row.original.categoryName}</span>
          {row.original.isSerialized && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              серийный
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "quantity",
      header: "Остаток",
      cell: ({ row }) => {
        const { quantity, minQty, unit } = row.original
        if (quantity === 0) {
          return <Badge variant="destructive">0 {unit}</Badge>
        }
        if (quantity <= minQty && minQty > 0) {
          return (
            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
              {quantity} {unit}
            </Badge>
          )
        }
        return (
          <Badge variant="outline" className="border-green-500 text-green-600">
            {quantity} {unit}
          </Badge>
        )
      },
    },
    {
      accessorKey: "minQty",
      header: "Мин.остаток",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.minQty} {row.original.unit}
        </span>
      ),
    },
    {
      accessorKey: "sellPrice",
      header: "Цена продажи",
      cell: ({ row }) => formatMoney(row.original.sellPrice),
    },
    ...(canSeePrices
      ? [
          {
            accessorKey: "costPrice" as const,
            header: "Себестоимость",
            cell: ({ row }: { row: { original: StockRow } }) =>
              row.original.costPrice != null ? formatMoney(row.original.costPrice) : "\u2014",
          } satisfies ColumnDef<StockRow>,
        ]
      : []),
  ]

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию, артикулу, штрихкоду..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={categoryId} onValueChange={(val) => setCategoryId(val ?? "")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Все категории</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Товары не найдены
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
