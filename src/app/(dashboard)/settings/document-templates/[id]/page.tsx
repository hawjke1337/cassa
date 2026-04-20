import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getDocumentTemplate } from "@/actions/document-templates"
import { EditorClient } from "./editor-client"

interface EditorPageProps {
  params: Promise<{ id: string }>
}

export default async function DocumentTemplateEditorPage({ params }: EditorPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const template = await getDocumentTemplate(id)

  return <EditorClient template={template} />
}
