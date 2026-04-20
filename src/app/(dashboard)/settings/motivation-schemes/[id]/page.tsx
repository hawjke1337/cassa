import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { getMotivationScheme } from "@/actions/motivation-schemes"
import { getMotivationGroups } from "@/actions/motivation-groups"
import { EditorClient } from "./editor-client"

interface Props {
  params: Promise<{ id: string }>
}

export default async function MotivationSchemeEditorPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const hasAccess = await checkPermission("motivation.schemes.manage")
  if (!hasAccess) redirect("/")

  const [scheme, groups] = await Promise.all([
    getMotivationScheme(id),
    getMotivationGroups(),
  ])

  return <EditorClient scheme={scheme} groups={groups} />
}
