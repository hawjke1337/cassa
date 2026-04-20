import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PrintLayout } from "@/components/print/print-layout"
import { getDocumentData, getDefaultTemplate } from "@/actions/document-templates"
import { DocumentRenderer } from "@/components/documents/document-renderer"
import type { DocumentLayout } from "@/lib/validations/document-templates"

interface PrintRepairReceiptPageProps {
  params: Promise<{ id: string }>
}

export default async function PrintRepairReceiptPage({
  params,
}: PrintRepairReceiptPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const docData = await getDocumentData("REPAIR_RECEIPT", id)
  const template = await getDefaultTemplate(docData.storeId, "REPAIR_RECEIPT")
  const layout = template.layout as unknown as DocumentLayout

  return (
    <PrintLayout title={`Акт приёмки ${docData.data.number}`}>
      <DocumentRenderer
        layout={layout}
        data={docData.data}
        items={docData.items}
        documentType="REPAIR_RECEIPT"
      />
    </PrintLayout>
  )
}
