import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PrintLayout } from "@/components/print/print-layout"
import { getDocumentData, getDefaultTemplate } from "@/actions/document-templates"
import { DocumentRenderer } from "@/components/documents/document-renderer"
import type { DocumentLayout } from "@/lib/validations/document-templates"

interface PrintReceivePageProps {
  params: Promise<{ id: string }>
}

export default async function PrintReceivePage({ params }: PrintReceivePageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const docData = await getDocumentData("RECEIVE_DOC", id)
  const template = await getDefaultTemplate(docData.storeId, "RECEIVE_DOC")
  const layout = template.layout as unknown as DocumentLayout

  return (
    <PrintLayout title={`Приходная накладная ${docData.data.number}`}>
      <DocumentRenderer
        layout={layout}
        data={docData.data}
        items={docData.items}
        documentType="RECEIVE_DOC"
      />
    </PrintLayout>
  )
}
