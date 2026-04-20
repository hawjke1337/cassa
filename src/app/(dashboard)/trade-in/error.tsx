"use client"

import { useEffect } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Alert variant="destructive" className="max-w-lg">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Произошла ошибка</AlertTitle>
        <AlertDescription className="mt-2">
          {process.env.NODE_ENV === "development"
            ? error.message
            : "Не удалось загрузить данные. Попробуйте ещё раз."}
        </AlertDescription>
        <Button variant="outline" onClick={reset} className="mt-4">
          Попробовать снова
        </Button>
      </Alert>
    </div>
  )
}
