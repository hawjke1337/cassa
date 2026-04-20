import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PrintLayout } from "@/components/print/print-layout"
import { getDocumentData, getDefaultTemplate } from "@/actions/document-templates"
import { DocumentRenderer } from "@/components/documents/document-renderer"
import type { DocumentLayout } from "@/lib/validations/document-templates"

interface PrintSalePageProps {
  params: Promise<{ id: string }>
}

export default async function PrintSalePage({ params }: PrintSalePageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const docData = await getDocumentData("SALE_RECEIPT", id)
  const template = await getDefaultTemplate(docData.storeId, "SALE_RECEIPT")
  const layout = template.layout as unknown as DocumentLayout

  return (
    <PrintLayout title={`Товарный чек ${docData.data.number}`}>
      <DocumentRenderer
        layout={layout}
        data={docData.data}
        items={docData.items}
        documentType="SALE_RECEIPT"
      />
    </PrintLayout>
  )
}
