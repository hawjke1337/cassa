"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"

import { productSchema, type ProductFormData } from "@/lib/validations/catalog"
import {
  createProduct,
  updateProduct,
  getCategories,
  getBrands,
  createBrand,
} from "@/actions/catalog"

interface ProductFormProps {
  storeId: string
  canSeePrices: boolean
  initialData?: ProductFormData & { id: string }
}

export function ProductForm({
  storeId,
  canSeePrices,
  initialData,
}: ProductFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEdit = !!initialData

  const [categories, setCategories] = useState<{ id: string; name: string; parentId: string | null }[]>([])
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([])
  const [newBrandOpen, setNewBrandOpen] = useState(false)
  const [newBrandName, setNewBrandName] = useState("")
  const [brandCreating, setBrandCreating] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema) as never,
    defaultValues: initialData
      ? {
          name: initialData.name,
          sku: initialData.sku,
          barcode: initialData.barcode,
          categoryId: initialData.categoryId,
          brandId: initialData.brandId,
          description: initialData.description,
          unit: initialData.unit,
          sellPrice: initialData.sellPrice,
          costPrice: initialData.costPrice,
          minQty: initialData.minQty,
        }
      : {
          unit: "шт",
          costPrice: 0,
          minQty: 0,
        },
  })

  const selectedCategoryId = watch("categoryId")
  const selectedBrandId = watch("brandId")

  useEffect(() => {
    async function loadData() {
      const [cats, brs] = await Promise.all([getCategories(), getBrands()])
      setCategories(cats)
      setBrands(brs)
    }
    loadData()
  }, [])

  const onSubmit = (data: ProductFormData) => {
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateProduct(initialData.id, storeId, data)
          toast.success("Товар обновлён")
        } else {
          await createProduct(storeId, data)
          toast.success("Товар создан")
        }
        router.push("/catalog")
        router.refresh()
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Произошла ошибка"
        toast.error(message)
      }
    })
  }

  const handleCreateBrand = async () => {
    if (!newBrandName.trim()) return
    setBrandCreating(true)
    try {
      const brand = await createBrand({ name: newBrandName.trim() })
      setBrands((prev) => [...prev, brand].sort((a, b) => a.name.localeCompare(b.name)))
      setValue("brandId", brand.id)
      setNewBrandName("")
      setNewBrandOpen(false)
      toast.success("Бренд создан")
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Ошибка создания бренда"
      toast.error(message)
    } finally {
      setBrandCreating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Название *</Label>
        <Input id="name" {...register("name")} placeholder="Название товара" />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* SKU + Barcode */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sku">Артикул *</Label>
          <Input id="sku" {...register("sku")} placeholder="SKU-001" />
          {errors.sku && (
            <p className="text-sm text-destructive">{errors.sku.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="barcode">Штрихкод</Label>
          <Input id="barcode" {...register("barcode")} placeholder="4600000000000" />
          {errors.barcode && (
            <p className="text-sm text-destructive">{errors.barcode.message}</p>
          )}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label>Категория *</Label>
        <Select
          value={selectedCategoryId || ""}
          onValueChange={(val) => setValue("categoryId", val ?? "", { shouldValidate: true })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Выберите категорию" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.parentId ? "  " : ""}{c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.categoryId && (
          <p className="text-sm text-destructive">{errors.categoryId.message}</p>
        )}
      </div>

      {/* Brand */}
      <div className="space-y-2">
        <Label>Бренд</Label>
        <div className="flex gap-2">
          <Select
            value={selectedBrandId || ""}
            onValueChange={(val) => setValue("brandId", val ?? null, { shouldValidate: true })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Выберите бренд" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Без бренда</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={newBrandOpen} onOpenChange={setNewBrandOpen}>
            <DialogTrigger render={<Button type="button" variant="outline" />}>
              +
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новый бренд</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="newBrand">Название</Label>
                <Input
                  id="newBrand"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="Название бренда"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleCreateBrand()
                    }
                  }}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={handleCreateBrand}
                  disabled={brandCreating || !newBrandName.trim()}
                >
                  {brandCreating && <Loader2 className="size-4 animate-spin" />}
                  Создать
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Unit */}
      <div className="space-y-2">
        <Label>Единица измерения</Label>
        <Select
          value={watch("unit") || "шт"}
          onValueChange={(val) => setValue("unit", val ?? "шт")}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="шт">шт</SelectItem>
            <SelectItem value="кг">кг</SelectItem>
            <SelectItem value="л">л</SelectItem>
            <SelectItem value="м">м</SelectItem>
            <SelectItem value="уп">уп</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Описание</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Описание товара"
        />
      </div>

      {/* Prices */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="sellPrice">Цена продажи *</Label>
          <Input
            id="sellPrice"
            type="number"
            step="0.01"
            {...register("sellPrice")}
            placeholder="0.00"
          />
          {errors.sellPrice && (
            <p className="text-sm text-destructive">
              {errors.sellPrice.message}
            </p>
          )}
        </div>
        {canSeePrices && (
          <div className="space-y-2">
            <Label htmlFor="costPrice">Себестоимость</Label>
            <Input
              id="costPrice"
              type="number"
              step="0.01"
              {...register("costPrice")}
              placeholder="0.00"
            />
            {errors.costPrice && (
              <p className="text-sm text-destructive">
                {errors.costPrice.message}
              </p>
            )}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="minQty">Мин. остаток</Label>
          <Input
            id="minQty"
            type="number"
            {...register("minQty")}
            placeholder="0"
          />
          {errors.minQty && (
            <p className="text-sm text-destructive">{errors.minQty.message}</p>
          )}
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Сохранить" : "Создать товар"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/catalog")}
        >
          Отмена
        </Button>
      </div>
    </form>
  )
}
