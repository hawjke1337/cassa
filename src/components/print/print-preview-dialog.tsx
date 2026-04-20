"use client"

/**
 * UX2-10: Модальное превью печати.
 *
 * Оборачивает любой printable компонент, показывает preview в Dialog
 * и предоставляет кнопки "Печать" / "Отмена". window.print() вызывается
 * только после явного подтверждения оператора — защита от случайной
 * печати (например, случайного Ctrl+P или двойного клика на иконке принтера).
 *
 * Печать использует стандартный window.print() — браузерный диалог
 * обрабатывает выбор принтера, pagination, маржины. CSS-класс
 * `.no-print` скрывает кнопки в момент печати (уже настроен глобально).
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

export interface PrintPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
  /**
   * Сконфигурированный обработчик печати. Если не передан — используется
   * стандартный window.print(). Полезно для ситуаций, когда нужно
   * открыть отдельный print-ready route.
   */
  onPrint?: () => void
}

export function PrintPreviewDialog({
  open,
  onOpenChange,
  title,
  children,
  onPrint,
}: PrintPreviewDialogProps) {
  function handlePrint() {
    if (onPrint) {
      onPrint()
      return
    }
    // Небольшая задержка, чтобы dialog успел скрыть кнопки (no-print)
    // перед вызовом нативного диалога печати.
    window.print()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-y-auto"
        aria-label={`Превью печати: ${title}`}
      >
        <DialogHeader>
          <DialogTitle>Превью печати — {title}</DialogTitle>
        </DialogHeader>
        <div className="print-preview-content rounded border bg-white p-4 text-black">
          {children}
        </div>
        <DialogFooter className="no-print">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            aria-label="Отменить печать"
          >
            Отмена
          </Button>
          <Button onClick={handlePrint} aria-label="Напечатать документ">
            <Printer className="mr-2 size-4" />
            Печать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
