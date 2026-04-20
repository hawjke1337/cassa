"use client"

import { useEffect, useState, useTransition } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getFeeSettings, saveFeeSettings } from "@/actions/fee-settings"
import { calcBankingFee } from "@/lib/money"
import { formatMoney } from "@/lib/format"

const METHOD_LABELS: Record<string, string> = {
  CASH: "Наличные",
  CARD: "Карта",
  SBP: "СБП",
  TRANSFER: "Перевод",
  CREDIT: "Рассрочка",
}

interface FeeSettingsFormProps {
  storeId: string
}

export function FeeSettingsForm({ storeId }: FeeSettingsFormProps) {
  const [rates, setRates] = useState<Array<{ method: string; feeRate: string }>>([])
  const [loadingData, setLoadingData] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setLoadingData(true)
    getFeeSettings(storeId)
      .then((data) => {
        setRates(
          data.map((d) => ({
            method: d.method,
            feeRate: (Number(d.feeRate) * 100).toFixed(2),
          })),
        )
      })
      .catch(() => toast.error("Не удалось загрузить ставки комиссий"))
      .finally(() => setLoadingData(false))
  }, [storeId])

  function handleRateChange(method: string, value: string) {
    setRates((prev) => prev.map((r) => (r.method === method ? { ...r, feeRate: value } : r)))
  }

  function computeExample(percentRate: string): string {
    const rate = Number(percentRate) / 100
    if (!rate || rate <= 0) return "0 ₽"
    try {
      const { fee } = calcBankingFee(10000, rate)
      return formatMoney(Number(fee.toFixed(2)))
    } catch {
      return "—"
    }
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const apiRates = rates.map((r) => ({
          method: r.method,
          feeRate: (Number(r.feeRate) / 100).toString(),
        }))
        await saveFeeSettings(storeId, apiRates)
        toast.success("Ставки комиссий сохранены")
      } catch {
        toast.error("Не удалось сохранить ставки. Попробуйте ещё раз.")
      }
    })
  }

  if (loadingData) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-2 h-4 w-96" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Комиссии по методам оплаты</CardTitle>
        <CardDescription>
          Укажите процент комиссии банка для каждого метода оплаты. Расчёт по формуле обратного
          процента (стандарт эквайринга).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Метод оплаты</TableHead>
              <TableHead className="w-32">Ставка, %</TableHead>
              <TableHead className="text-right">Пример (10 000 ₽)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((r) => (
              <TableRow key={r.method} className={r.method === "CASH" ? "bg-muted/50" : undefined}>
                <TableCell className="font-medium">{METHOD_LABELS[r.method]}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="99"
                    value={r.feeRate}
                    onChange={(e) => handleRateChange(r.method, e.target.value)}
                    disabled={r.method === "CASH"}
                    className="w-20"
                    aria-label={`Ставка комиссии для ${METHOD_LABELS[r.method]}`}
                  />
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {computeExample(r.feeRate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Сохранить ставки
        </Button>
      </CardFooter>
    </Card>
  )
}
