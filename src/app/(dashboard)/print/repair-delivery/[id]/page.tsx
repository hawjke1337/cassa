import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getRepair } from "@/actions/repairs"
import { PrintLayout } from "@/components/print/print-layout"
import { getDocumentData, getDefaultTemplate } from "@/actions/document-templates"
import { DocumentRenderer } from "@/components/documents/document-renderer"
import type { DocumentLayout } from "@/lib/validations/document-templates"

interface PrintRepairDeliveryPageProps {
  params: Promise<{ id: string }>
}

export default async function PrintRepairDeliveryPage({
  params,
}: PrintRepairDeliveryPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const repair = await getRepair(id)
  if (repair.status !== "DELIVERED") redirect(`/repairs/${id}`)

  const docData = await getDocumentData("REPAIR_DELIVERY", id)
  const template = await getDefaultTemplate(docData.storeId, "REPAIR_DELIVERY")
  const layout = template.layout as unknown as DocumentLayout

  return (
    <PrintLayout title={`Акт выдачи ${docData.data.number}`}>
      <DocumentRenderer
        layout={layout}
        data={docData.data}
        items={docData.items}
        documentType="REPAIR_DELIVERY"
      />
    </PrintLayout>
  )
}
