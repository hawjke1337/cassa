import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { DocumentTemplatesClient } from "./document-templates-client"

export default async function DocumentTemplatesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canManage = await checkPermission("settings.templates")
  if (!canManage) redirect("/settings/profile")

  return <DocumentTemplatesClient />
}
