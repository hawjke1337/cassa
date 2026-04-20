"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPendingSchemes } from "@/actions/motivation-schemes"

interface PendingScheme {
  id: string
  name: string
  storeName: string | null
  createdByName: string
  createdAt: string
}

export function ApprovalsClient() {
  const router = useRouter()
  const [schemes, setSchemes] = useState<PendingScheme[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const pending = await getPendingSchemes()
        setSchemes(pending.map((s) => ({
          ...s,
          createdAt: new Date(s.createdAt).toLocaleDateString("ru-RU"),
        })))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return <div className="text-sm text-muted-foreground">Загрузка...</div>
  }

  if (schemes.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Подтверждение схем</h1>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          <Clock className="mx-auto size-8 mb-2 opacity-50" />
          <p>Нет схем, ожидающих подтверждения</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Подтверждение схем</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {schemes.map((scheme) => (
          <Card
            key={scheme.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push(`/motivation/approvals/${scheme.id}`)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{scheme.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>Магазин: {scheme.storeName ?? "Общая"}</p>
              <p>Автор: {scheme.createdByName}</p>
              <p>Создана: {scheme.createdAt}</p>
              <div className="pt-2">
                <Button variant="outline" size="sm" className="w-full">
                  Просмотреть <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
