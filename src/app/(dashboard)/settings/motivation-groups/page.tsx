import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { getMotivationGroups } from "@/actions/motivation-groups"
import { MotivationGroupsClient } from "./motivation-groups-client"

export default async function MotivationGroupsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const hasAccess = await checkPermission("motivation.groups.manage")
  if (!hasAccess) redirect("/")

  const groups = await getMotivationGroups()

  return <MotivationGroupsClient initialGroups={groups} />
}
