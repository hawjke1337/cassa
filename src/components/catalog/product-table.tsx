"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  flexRender,
} from "@tanstack/react-table"
import { Search, Tag } from "lucide-react"
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
import { getProducts, getCategories, getBrands } from "@/actions/catalog"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { PrintLabelsDialog } from "@/components/price-labels/print-labels-dialog"

interface ProductRow {
  id: string
  name: string
  sku: string
  barcode: string | null
  categoryName: string
  brandName: string | null
  quantity: number
  minQty: number
  sellPrice: number
  costPrice: number | null
  unit: string
}

interface ProductTableProps {
  storeId: string
  canSeePrices: boolean
}

export function ProductTable({ storeId, canSeePrices }: ProductTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)

  const [products, setProducts] = useState<ProductRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const perPage = 20

  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState<string>("")
  const [brandId, setBrandId] = useState<string>("")

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([])

  // Load filters
  useEffect(() => {
    async function loadFilters() {
      const [cats, brs] = await Promise.all([getCategories(), getBrands()])
      setCategories(cats)
      setBrands(brs)
    }
    loadFilters()
  }, [])

  const loadProducts = useCallback(async () => {
    setIsLoading(true)
    startTransition(async () => {
      try {
        const result = await getProducts(storeId, {
          search: search || undefined,
          categoryId: categoryId || undefined,
          brandId: brandId || undefined,
          page,
          perPage,
        })
        setProducts(result.products)
        setTotal(result.total)
        setTotalPages(result.totalPages)
      } finally {
        setIsLoading(false)
      }
    })
  }, [storeId, search, categoryId, brandId, page, perPage])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [search, categoryId, brandId])

  const columns: ColumnDef<ProductRow>[] = [
    {
      accessorKey: "name",
      header: "Название",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.name}</div>
      ),
    },
    {
      accessorKey: "sku",
      header: "Артикул",
    },
    {
      accessorKey: "categoryName",
      header: "Категория",
    },
    {
      accessorKey: "brandName",
      header: "Бренд",
      cell: ({ row }) => row.original.brandName ?? "—",
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
          <span>
            {quantity} {unit}
          </span>
        )
      },
    },
    {
      accessorKey: "sellPrice",
      header: "Цена продажи",
      cell: ({ row }) => (
        <span>{row.original.sellPrice.toLocaleString("ru-RU")} ₽</span>
      ),
    },
    ...(canSeePrices
      ? [
          {
            accessorKey: "costPrice" as const,
            header: "Себестоимость",
            cell: ({ row }: { row: { original: ProductRow } }) =>
              row.original.costPrice != null ? (
                <span>{row.original.costPrice.toLocaleString("ru-RU")} ₽</span>
              ) : (
                "—"
              ),
          } satisfies ColumnDef<ProductRow>,
        ]
      : []),
    {
      id: "actions",
      header: "",
      cell: ({ row }: { row: { original: ProductRow } }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <PrintLabelsDialog
            trigger={
              <Button variant="ghost" size="icon" title="Печать ценника">
                <Tag className="size-4" />
              </Button>
            }
            preselectedProducts={[{
              id: row.original.id,
              name: row.original.name,
              sku: row.original.sku,
            }]}
          />
        </div>
      ),
    } satisfies ColumnDef<ProductRow>,
  ]

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
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
        <div className="flex gap-2">
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
          <Select value={brandId} onValueChange={(val) => setBrandId(val ?? "")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Бренд" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Все бренды</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
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
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/catalog/${row.original.id}`)
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Всего: {total}
          </p>
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
