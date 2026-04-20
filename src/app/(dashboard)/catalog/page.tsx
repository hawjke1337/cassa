import { redirect } from "next/navigation"

/**
 * UX2-16: /catalog объединён с /inventory в /products?tab=catalog.
 * Redirect сохраняет обратную совместимость для закладок и внешних ссылок.
 * Подстраницы (/catalog/[id], /catalog/new, /catalog/categories) остаются
 * работоспособными через свои собственные page.tsx.
 */
export default function CatalogRedirect() {
  redirect("/products?tab=catalog")
}
