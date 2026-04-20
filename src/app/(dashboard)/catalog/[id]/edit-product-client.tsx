"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Trash2 } from "lucide-react"

import { useCurrentStore } from "@/hooks/use-current-store"
import { ProductForm } from "@/components/catalog/product-form"
import { Button } from "@/components/ui/button"
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
import { Skeleton } from "@/components/ui/skeleton"
import { getProduct, deleteProduct } from "@/actions/catalog"
import type { ProductFormData } from "@/lib/validations/catalog"

interface EditProductClientProps {
  productId: string
  canSeePrices: boolean
  canEdit: boolean
}

export function EditProductClient({
  productId,
  canSeePrices,
  canEdit,
}: EditProductClientProps) {
  const router = useRouter()
  const { currentStoreId } = useCurrentStore()
  const [product, setProduct] = useState<(ProductFormData & { id: string }) | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!currentStoreId) return

    async function load() {
      setIsLoading(true)
      try {
        const data = await getProduct(productId, currentStoreId!)
        setProduct({
          id: data.id,
          name: data.name,
          sku: data.sku,
          barcode: data.barcode,
          categoryId: data.categoryId,
          brandId: data.brandId,
          description: data.description,
          unit: data.unit,
          sellPrice: data.sellPrice,
          costPrice: data.costPrice ?? 0,
          minQty: data.minQty,
        })
      } catch {
        toast.error("Товар не найден")
        router.push("/catalog")
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [productId, currentStoreId, router])

  if (!currentStoreId) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Выберите магазин
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Товар не найден
      </div>
    )
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteProduct(productId)
      toast.success("Товар удалён")
      router.push("/catalog")
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Ошибка удаления"
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="destructive" size="sm" />}
            >
              <Trash2 className="size-4" />
              Удалить товар
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить товар?</AlertDialogTitle>
                <AlertDialogDescription>
                  Товар &quot;{product.name}&quot; будет деактивирован. Это действие нельзя отменить.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  variant="destructive"
                >
                  {isDeleting && <Loader2 className="size-4 animate-spin" />}
                  Удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <ProductForm
        storeId={currentStoreId}
        canSeePrices={canSeePrices}
        initialData={product}
      />
    </div>
  )
}
