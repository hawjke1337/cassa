"use client"

/**
 * UX2-17: Сетка категорий для POS.
 *
 * Показывается, когда поиск пуст — оператору не нужно помнить SKU,
 * он может начать с категории. После клика компонент вызывает onSelect,
 * родитель подставляет название категории в search (или применяет
 * фильтр по categoryId) и загружает товары.
 *
 * Responsive: 2 колонки на мобильных, 3 на средних, 4 на больших экранах
 * (соответствует POS product list breakpoints для визуальной консистентности).
 */

import { Package } from "lucide-react"

export interface CategoryGridItem {
  id: string
  name: string
  productCount: number
}

export interface CategoryGridProps {
  categories: CategoryGridItem[]
  onSelect: (category: CategoryGridItem) => void
}

export function CategoryGrid({ categories, onSelect }: CategoryGridProps) {
  if (categories.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Категории не настроены
      </div>
    )
  }

  return (
    <div
      className="grid grid-cols-2 gap-3 p-2 md:grid-cols-3 lg:grid-cols-4"
      role="list"
      aria-label="Каталог категорий"
    >
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelect(cat)}
          role="listitem"
          aria-label={`Категория: ${cat.name}, ${cat.productCount} товаров`}
          className="flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-accent active:bg-accent/70"
        >
          <Package className="size-8 text-muted-foreground" aria-hidden />
          <span className="line-clamp-2 text-center text-sm font-medium">{cat.name}</span>
          <span className="text-xs text-muted-foreground">{cat.productCount} товаров</span>
        </button>
      ))}
    </div>
  )
}
