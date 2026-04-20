"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Trash2, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
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
import {
  addProductsToGroup,
  removeProductFromGroup,
  searchProductsForGroup,
} from "@/actions/motivation-groups"
import { toast } from "sonner"

type GroupProduct = {
  id: string
  name: string
  sku: string
  categoryName: string
}

type Group = {
  id: string
  code: string
  name: string
  description: string | null
  products: GroupProduct[]
}

type SearchResult = {
  id: string
  name: string
  sku: string
  categoryName: string
  currentGroupId: string | null
  currentGroupName: string | null
}

interface EditorClientProps {
  group: Group
}

export function EditorClient({ group }: EditorClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Add products dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search
  useEffect(() => {
    if (!addDialogOpen) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchProductsForGroup(searchQuery, group.id)
        setSearchResults(results)
      } catch {
        toast.error("Ошибка поиска товаров")
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, addDialogOpen, group.id])

  function handleOpenAddDialog() {
    setSearchQuery("")
    setSearchResults([])
    setSelectedIds(new Set())
    setAddDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    setAddDialogOpen(open)
    if (!open) {
      setSearchQuery("")
      setSearchResults([])
      setSelectedIds(new Set())
    }
  }

  function toggleProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleAddProducts() {
    if (selectedIds.size === 0) {
      toast.error("Выберите хотя бы один товар")
      return
    }

    startTransition(async () => {
      try {
        const result = await addProductsToGroup(group.id, [...selectedIds])
        const msg =
          result.moved > 0
            ? `Добавлено: ${result.added}, перемещено из других групп: ${result.moved}`
            : `Добавлено товаров: ${result.added}`
        toast.success(msg)
        setAddDialogOpen(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка добавления")
      }
    })
  }

  function handleRemoveProduct(productId: string) {
    startTransition(async () => {
      try {
        await removeProductFromGroup(group.id, productId)
        toast.success("Товар удалён из группы")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка удаления")
      }
    })
  }

  // Filter out products already in this group from search results
  const currentProductIds = new Set(group.products.map((p) => p.id))
  const filteredResults = searchResults.filter((r) => !currentProductIds.has(r.id))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.push("/settings/motivation-groups")}
            >
              <ArrowLeft className="size-4" />
              <span className="sr-only">Назад</span>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
          </div>
          <div className="flex items-center gap-3 pl-9">
            <span className="font-mono text-sm text-muted-foreground">
              {group.code}
            </span>
            {group.description && (
              <span className="text-sm text-muted-foreground">
                {group.description}
              </span>
            )}
          </div>
        </div>

        <Button size="sm" onClick={handleOpenAddDialog}>
          <Plus className="size-4" />
          Добавить товары
        </Button>
      </div>

      {/* Products table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Артикул</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  В группе нет товаров
                </TableCell>
              </TableRow>
            ) : (
              group.products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {product.sku}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.categoryName}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={isPending}
                          >
                            <Trash2 className="size-4 text-muted-foreground" />
                            <span className="sr-only">Удалить из группы</span>
                          </Button>
                        }
                      />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Убрать товар из группы?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Товар &quot;{product.name}&quot; будет удалён из
                            группы &quot;{group.name}&quot;.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveProduct(product.id)}
                          >
                            Удалить
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add products dialog */}
      <Dialog open={addDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Добавить товары</DialogTitle>
            <DialogDescription>
              Найдите и выберите товары для добавления в группу &quot;
              {group.name}&quot;
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Поиск по названию или артикулу..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Артикул</TableHead>
                    <TableHead>Категория</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isSearching ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-20 text-center text-muted-foreground"
                      >
                        <Loader2 className="mx-auto size-4 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : filteredResults.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-20 text-center text-muted-foreground"
                      >
                        {searchQuery
                          ? "Товары не найдены"
                          : "Введите запрос для поиска"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredResults.map((product) => (
                      <TableRow
                        key={product.id}
                        className="cursor-pointer"
                        onClick={() => toggleProduct(product.id)}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(product.id)}
                            onCheckedChange={() => toggleProduct(product.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="font-medium">{product.name}</div>
                            {product.currentGroupName && (
                              <div className="flex items-center gap-1 text-xs text-amber-600">
                                <AlertTriangle className="size-3" />
                                Сейчас в группе: {product.currentGroupName}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {product.sku}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {product.categoryName}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {selectedIds.size > 0 && (
              <p className="text-sm text-muted-foreground">
                Выбрано: {selectedIds.size}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={isPending}
            >
              Отмена
            </Button>
            <Button
              onClick={handleAddProducts}
              disabled={isPending || selectedIds.size === 0}
            >
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Добавить{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
