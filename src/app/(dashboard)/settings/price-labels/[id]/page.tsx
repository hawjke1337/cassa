import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { EditorClient } from "./editor-client"

export default async function LabelEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const canManage = await checkPermission("settings.templates")
  if (!canManage) redirect("/settings/profile")

  return <EditorClient templateId={id} />
}
