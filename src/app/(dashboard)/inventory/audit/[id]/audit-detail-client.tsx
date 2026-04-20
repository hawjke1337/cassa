"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  getAudit,
  updateAuditItem,
  closeAudit,
  scanAuditImei,
  getAuditSerialResults,
} from "@/actions/inventory"
import { isValidImei } from "@/lib/imei-utils"
import { formatDate } from "@/lib/format"
import { toast } from "sonner"
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react"

interface AuditItem {
  id: string
  productId: string
  productName: string
  productSku: string
  unit: string
  expectedQty: number
  actualQty: number | null
  difference: number | null
}

interface AuditData {
  id: string
  number: string
  status: string
  storeName: string
  storeId: string
  createdByName: string
  createdAt: string
  closedAt: string | null
  items: AuditItem[]
}

interface SerialScanResult {
  id: string
  status: "FOUND" | "MISSING" | "SURPLUS"
  scannedImei: string
  productName: string
  productSku: string
  imei: string
  imei2: string | null
  serialNumber: string | null
}

export function AuditDetailClient({ auditId }: { auditId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)
  const [audit, setAudit] = useState<AuditData | null>(null)

  // Scanning mode state
  const [scanInput, setScanInput] = useState("")
  const [scanError, setScanError] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [serialResults, setSerialResults] = useState<SerialScanResult[]>([])
  const scanInputRef = useRef<HTMLInputElement>(null)

  const loadAudit = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getAudit(auditId)
      setAudit(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка загрузки")
    } finally {
      setIsLoading(false)
    }
  }, [auditId])

  const loadSerialResults = useCallback(async () => {
    try {
      const results = await getAuditSerialResults(auditId)
      setSerialResults(results)
    } catch {
      // Silently fail — results will be empty
    }
  }, [auditId])

  useEffect(() => {
    loadAudit()
    loadSerialResults()
  }, [loadAudit, loadSerialResults])

  async function handleUpdateItem(itemId: string, actualQty: number) {
    try {
      await updateAuditItem(itemId, actualQty)
      setAudit((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === itemId
              ? { ...item, actualQty, difference: actualQty - item.expectedQty }
              : item
          ),
        }
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка обновления")
    }
  }

  async function handleScanImei() {
    const imei = scanInput.trim()
    if (!imei) return

    if (!/^\d{15}$/.test(imei)) {
      setScanError("IMEI должен содержать 15 цифр")
      return
    }
    if (!isValidImei(imei)) {
      setScanError("Некорректная контрольная сумма IMEI")
      return
    }

    setScanError("")
    setIsScanning(true)

    try {
      const result = await scanAuditImei(auditId, imei)
      // Add to the top of results list
      setSerialResults((prev) => [
        {
          id: result.id,
          status: result.status,
          scannedImei: result.scannedImei,
          productName: result.productName,
          productSku: result.productSku,
          imei: result.scannedImei,
          imei2: null,
          serialNumber: null,
        },
        ...prev,
      ])
      setScanInput("")
      if (result.status === "FOUND") {
        toast.success(`${result.productName} -- найден`)
      } else {
        toast.warning(`${result.productName} -- излишек`)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Ошибка сканирования"
      setScanError(msg)
      toast.error(msg)
    } finally {
      setIsScanning(false)
      scanInputRef.current?.focus()
    }
  }

  async function handleClose() {
    startTransition(async () => {
      try {
        await closeAudit(auditId)
        toast.success("Инвентаризация закрыта. Остатки скорректированы.")
        loadAudit()
        loadSerialResults()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка закрытия")
      }
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!audit) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Инвентаризация не найдена
      </div>
    )
  }

  const isDraft = audit.status === "DRAFT"
  const totalItems = audit.items.length
  const filledItems = audit.items.filter((i) => i.actualQty !== null).length
  const discrepancies = audit.items.filter(
    (i) => i.difference !== null && i.difference !== 0
  ).length

  const foundCount = serialResults.filter((r) => r.status === "FOUND").length
  const surplusCount = serialResults.filter((r) => r.status === "SURPLUS").length
  const missingCount = serialResults.filter((r) => r.status === "MISSING").length

  return (
    <div className="space-y-6">
      {/* Info header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-semibold">{audit.number}</span>
            {isDraft ? (
              <Badge variant="outline">В работе</Badge>
            ) : (
              <Badge variant="default" className="bg-green-600">Закрыта</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Магазин: {audit.storeName} | Создал: {audit.createdByName} | {formatDate(audit.createdAt)}
          </p>
          {audit.closedAt && (
            <p className="text-sm text-muted-foreground">
              Закрыта: {formatDate(audit.closedAt)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span>
            Подсчитано: <strong>{filledItems}</strong> / {totalItems}
          </span>
          {discrepancies > 0 && (
            <span className="text-yellow-500">
              Расхождений: <strong>{discrepancies}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Scanning mode — only shown for DRAFT audits */}
      {isDraft && (
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="font-semibold text-base">Режим сканирования</h3>
          <p className="text-sm text-muted-foreground">
            Сканируйте IMEI сериализованных товаров. Несериализованные товары учитываются в таблице ниже.
          </p>

          {/* Scanner input */}
          <div className="flex gap-2 max-w-lg">
            <div className="flex-1">
              <Input
                ref={scanInputRef}
                value={scanInput}
                onChange={(e) => {
                  setScanInput(e.target.value)
                  setScanError("")
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleScanImei()
                }}
                placeholder="Введите или отсканируйте IMEI..."
                disabled={isScanning}
                className={scanError ? "border-red-500" : ""}
                autoFocus
              />
              {scanError && (
                <p className="text-xs text-red-500 mt-1">{scanError}</p>
              )}
            </div>
            <Button
              onClick={handleScanImei}
              disabled={isScanning || !scanInput.trim()}
              size="default"
            >
              Сканировать
            </Button>
          </div>

          {/* Summary counts */}
          {serialResults.length > 0 && (
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Найдено: <strong>{foundCount}</strong>
              </span>
              <span className="flex items-center gap-1 text-red-500">
                <XCircle className="h-4 w-4" />
                Излишки: <strong>{surplusCount}</strong>
              </span>
              {missingCount > 0 && (
                <span className="flex items-center gap-1 text-yellow-500">
                  <AlertTriangle className="h-4 w-4" />
                  Не найдено: <strong>{missingCount}</strong>
                </span>
              )}
            </div>
          )}

          {/* Scan results list */}
          {serialResults.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>IMEI</TableHead>
                    <TableHead>Товар</TableHead>
                    <TableHead>Артикул</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serialResults.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell>
                        {result.status === "FOUND" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : result.status === "SURPLUS" ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {result.scannedImei}
                      </TableCell>
                      <TableCell>{result.productName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {result.productSku}
                      </TableCell>
                      <TableCell>
                        {result.status === "FOUND" ? (
                          <Badge variant="outline" className="border-green-500 text-green-600">
                            Найден
                          </Badge>
                        ) : result.status === "SURPLUS" ? (
                          <Badge variant="outline" className="border-red-500 text-red-500">
                            Излишек
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                            Не найден
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Scan results for closed audits */}
      {!isDraft && serialResults.length > 0 && (
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="font-semibold text-base">Результаты сканирования IMEI</h3>
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Найдено: <strong>{foundCount}</strong>
            </span>
            <span className="flex items-center gap-1 text-red-500">
              <XCircle className="h-4 w-4" />
              Излишки: <strong>{surplusCount}</strong>
            </span>
            {missingCount > 0 && (
              <span className="flex items-center gap-1 text-yellow-500">
                <AlertTriangle className="h-4 w-4" />
                Не найдено: <strong>{missingCount}</strong>
              </span>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>IMEI</TableHead>
                  <TableHead>Товар</TableHead>
                  <TableHead>Артикул</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serialResults.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>
                      {result.status === "FOUND" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : result.status === "SURPLUS" ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {result.scannedImei}
                    </TableCell>
                    <TableCell>{result.productName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {result.productSku}
                    </TableCell>
                    <TableCell>
                      {result.status === "FOUND" ? (
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          Найден
                        </Badge>
                      ) : result.status === "SURPLUS" ? (
                        <Badge variant="outline" className="border-red-500 text-red-500">
                          Излишек
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                          Не найден
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Товар</TableHead>
              <TableHead>Артикул</TableHead>
              <TableHead className="text-center">Ожидаемое</TableHead>
              <TableHead className="text-center w-[140px]">Фактическое</TableHead>
              <TableHead className="text-center">Разница</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {audit.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.productName}</TableCell>
                <TableCell className="text-muted-foreground">{item.productSku}</TableCell>
                <TableCell className="text-center">
                  {item.expectedQty} {item.unit}
                </TableCell>
                <TableCell className="text-center">
                  {isDraft ? (
                    <Input
                      type="number"
                      min={0}
                      value={item.actualQty ?? ""}
                      placeholder={"\u2014"}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === "") return
                        handleUpdateItem(item.id, parseInt(val) || 0)
                      }}
                      className="mx-auto h-8 w-20 text-center"
                    />
                  ) : (
                    <span>
                      {item.actualQty !== null ? `${item.actualQty} ${item.unit}` : "\u2014"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {item.difference !== null ? (
                    <span
                      className={
                        item.difference < 0
                          ? "font-semibold text-red-500"
                          : item.difference > 0
                          ? "font-semibold text-green-500"
                          : "text-muted-foreground"
                      }
                    >
                      {item.difference > 0 ? "+" : ""}
                      {item.difference} {item.unit}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Close audit button */}
      {isDraft && (
        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  disabled={isPending || filledItems < totalItems}
                >
                  Закрыть инвентаризацию
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Закрыть инвентаризацию?</AlertDialogTitle>
                <AlertDialogDescription>
                  {discrepancies > 0
                    ? `Обнаружено ${discrepancies} расхождений. Остатки будут автоматически скорректированы (излишки оприходованы, недостачи списаны).`
                    : "Расхождений не обнаружено. Остатки не изменятся."}
                  {serialResults.length > 0 &&
                    ` Отсканировано IMEI: ${serialResults.length}. Неотсканированные серийные единицы будут помечены как "Не найдено".`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={handleClose}>
                  Подтвердить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
