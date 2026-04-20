import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { getMotivationGroup } from "@/actions/motivation-groups"
import { EditorClient } from "./editor-client"

interface Props {
  params: Promise<{ id: string }>
}

export default async function MotivationGroupEditorPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const hasAccess = await checkPermission("motivation.groups.manage")
  if (!hasAccess) redirect("/")

  const group = await getMotivationGroup(id)

  return <EditorClient group={group} />
}
