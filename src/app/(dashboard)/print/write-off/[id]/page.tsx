import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PrintLayout } from "@/components/print/print-layout"
import { getDocumentData, getDefaultTemplate } from "@/actions/document-templates"
import { DocumentRenderer } from "@/components/documents/document-renderer"
import type { DocumentLayout } from "@/lib/validations/document-templates"

interface PrintWriteOffPageProps {
  params: Promise<{ id: string }>
}

export default async function PrintWriteOffPage({ params }: PrintWriteOffPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const docData = await getDocumentData("WRITE_OFF_DOC", id)
  const template = await getDefaultTemplate(docData.storeId, "WRITE_OFF_DOC")
  const layout = template.layout as unknown as DocumentLayout

  return (
    <PrintLayout title={`Акт списания ${docData.data.number}`}>
      <DocumentRenderer
        layout={layout}
        data={docData.data}
        items={docData.items}
        documentType="WRITE_OFF_DOC"
      />
    </PrintLayout>
  )
}
