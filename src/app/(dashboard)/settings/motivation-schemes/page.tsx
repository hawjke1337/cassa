import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { getMotivationSchemes } from "@/actions/motivation-schemes"
import { MotivationSchemesClient } from "./motivation-schemes-client"

export default async function MotivationSchemesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const hasAccess = await checkPermission("motivation.schemes.manage")
  if (!hasAccess) redirect("/")

  const canApprove = await checkPermission("motivation.schemes.approve")
  const schemes = await getMotivationSchemes()

  return <MotivationSchemesClient initialSchemes={schemes} canApprove={canApprove} />
}
