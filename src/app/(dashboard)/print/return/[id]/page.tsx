import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PrintLayout } from "@/components/print/print-layout"
import { getDocumentData, getDefaultTemplate } from "@/actions/document-templates"
import { DocumentRenderer } from "@/components/documents/document-renderer"
import type { DocumentLayout } from "@/lib/validations/document-templates"

interface PrintReturnPageProps {
  params: Promise<{ id: string }>
}

export default async function PrintReturnPage({ params }: PrintReturnPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const docData = await getDocumentData("RETURN_ACT", id)
  const template = await getDefaultTemplate(docData.storeId, "RETURN_ACT")
  const layout = template.layout as unknown as DocumentLayout

  return (
    <PrintLayout title={`Акт возврата ${docData.data.returnNumber}`}>
      <DocumentRenderer
        layout={layout}
        data={docData.data}
        items={docData.items}
        documentType="RETURN_ACT"
      />
    </PrintLayout>
  )
}
