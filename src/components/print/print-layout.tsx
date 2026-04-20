"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

interface PrintLayoutProps {
  children: React.ReactNode
  title?: string
}

export function PrintLayout({ children, title }: PrintLayoutProps) {
  useEffect(() => {
    if (title) {
      document.title = title
    }
  }, [title])

  return (
    <>
      <div className="no-print flex items-center justify-center gap-3 bg-background p-4">
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          Печать
        </Button>
        <Button variant="outline" onClick={() => window.close()}>
          Закрыть
        </Button>
      </div>
      <div className="print-area print-document">
        {children}
      </div>
    </>
  )
}
