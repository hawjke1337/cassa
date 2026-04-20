import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PrintLayout } from "@/components/print/print-layout"
import { getDocumentData, getDefaultTemplate } from "@/actions/document-templates"
import { DocumentRenderer } from "@/components/documents/document-renderer"
import type { DocumentLayout } from "@/lib/validations/document-templates"

interface PrintTradeInContractPageProps {
  params: Promise<{ id: string }>
}

export default async function PrintTradeInContractPage({ params }: PrintTradeInContractPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const docData = await getDocumentData("TRADE_IN_CONTRACT", id)
  const template = await getDefaultTemplate(docData.storeId, "TRADE_IN_CONTRACT")
  const layout = template.layout as unknown as DocumentLayout

  return (
    <PrintLayout title={`Договор купли-продажи ${docData.data.number}`}>
      <DocumentRenderer
        layout={layout}
        data={docData.data}
        items={docData.items}
        documentType="TRADE_IN_CONTRACT"
      />
    </PrintLayout>
  )
}
