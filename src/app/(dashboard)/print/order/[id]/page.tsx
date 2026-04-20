import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PrintLayout } from "@/components/print/print-layout"
import { getDocumentData, getDefaultTemplate } from "@/actions/document-templates"
import { DocumentRenderer } from "@/components/documents/document-renderer"
import type { DocumentLayout } from "@/lib/validations/document-templates"

interface PrintOrderPageProps {
  params: Promise<{ id: string }>
}

export default async function PrintOrderPage({ params }: PrintOrderPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const docData = await getDocumentData("ORDER_FORM", id)
  const template = await getDefaultTemplate(docData.storeId, "ORDER_FORM")
  const layout = template.layout as unknown as DocumentLayout

  return (
    <PrintLayout title={`Бланк заказа ${docData.data.number}`}>
      <DocumentRenderer
        layout={layout}
        data={docData.data}
        items={docData.items}
        documentType="ORDER_FORM"
      />
    </PrintLayout>
  )
}
