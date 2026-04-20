import { redirect } from "next/navigation"

/**
 * UX2-16: /inventory объединён с /catalog в /products?tab=warehouse.
 * Redirect сохраняет обратную совместимость для закладок и внешних ссылок.
 * Подстраницы (/inventory/audit, /inventory/receive, /inventory/transfer,
 * /inventory/write-off) остаются работоспособными через свои page.tsx.
 */
export default function InventoryRedirect() {
  redirect("/products?tab=warehouse")
}
