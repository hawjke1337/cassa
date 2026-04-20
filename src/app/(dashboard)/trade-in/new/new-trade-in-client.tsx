"use client"

import { useState, useTransition, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useCurrentStore } from "@/hooks/use-current-store"
import { searchCustomers, createCustomer } from "@/actions/customers"
import { createTradeIn } from "@/actions/trade-in"
import { TRADE_IN_TYPE_LABELS } from "@/lib/validations/trade-in"
import { TradeInForm, type TradeInFormValues } from "@/components/inventory/trade-in-form"
import { PAYMENT_METHOD_LABELS } from "@/lib/document-variables"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Search, Plus, Loader2, ArrowLeft, User, Smartphone, FileText } from "lucide-react"

export function NewTradeInClient() {
  const router = useRouter()
  const { currentStoreId } = useCurrentStore()

  // Customer
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    passportSeries: "",
    passportNumber: "",
    passportIssuedBy: "",
    passportIssuedAt: "",
    comment: "",
  })
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)

  // Device + Pricing collected via TradeInForm
  const [tradeInValues, setTradeInValues] = useState<TradeInFormValues | null>(null)

  // Deal
  const [dealType, setDealType] = useState<"TRADE_IN" | "BUYBACK">("TRADE_IN")
  const [paymentMethod, setPaymentMethod] = useState("")

  // UI
  const [isPending, startTransition] = useTransition()
  const [isSearching, setIsSearching] = useState(false)

  // Customer search debounce
  useEffect(() => {
    if (customerSearch.length < 2) {
      setCustomerResults([])
      return
    }
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchCustomers(customerSearch)
        setCustomerResults(results)
      } finally {
        setIsSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch])

  const handleSelectCustomer = useCallback((customer: any) => {
    setSelectedCustomer(customer)
    setCustomerSearch("")
    setCustomerResults([])
    setShowNewCustomerForm(false)
  }, [])

  const handleCreateCustomer = useCallback(async () => {
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
      toast.error("Укажите ФИО и телефон")
      return
    }
    setIsCreatingCustomer(true)
    try {
      const created = await createCustomer({
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim(),
        passportSeries: newCustomer.passportSeries || undefined,
        passportNumber: newCustomer.passportNumber || undefined,
        passportIssuedBy: newCustomer.passportIssuedBy || undefined,
        passportIssuedAt: newCustomer.passportIssuedAt
          ? new Date(newCustomer.passportIssuedAt)
          : undefined,
        comment: newCustomer.comment || undefined,
      })
      setSelectedCustomer({
        id: created.id,
        name: created.name,
        phone: created.phone,
        passportSeries: newCustomer.passportSeries,
        passportNumber: newCustomer.passportNumber,
      })
      setShowNewCustomerForm(false)
      setNewCustomer({
        name: "",
        phone: "",
        passportSeries: "",
        passportNumber: "",
        passportIssuedBy: "",
        passportIssuedAt: "",
        comment: "",
      })
      toast.success("Клиент создан")
    } catch (err: any) {
      toast.error(err.message ?? "Ошибка создания клиента")
    } finally {
      setIsCreatingCustomer(false)
    }
  }, [newCustomer])

  const isSubmitDisabled =
    !selectedCustomer || !tradeInValues || (dealType === "BUYBACK" && !paymentMethod) || isPending

  const handleSubmit = useCallback(() => {
    if (!currentStoreId) {
      toast.error("Выберите магазин")
      return
    }
    startTransition(async () => {
      try {
        const result = await createTradeIn({
          storeId: currentStoreId,
          customerId: selectedCustomer!.id,
          type: dealType,
          deviceType: tradeInValues!.deviceType,
          deviceBrand: tradeInValues!.deviceBrand,
          deviceModel: tradeInValues!.deviceModel,
          deviceImei: tradeInValues!.deviceImei,
          deviceCondition: tradeInValues!.deviceCondition,
          agreedPrice: tradeInValues!.agreedPrice,
          initialStatus: tradeInValues!.initialStatus,
          paymentMethod: dealType === "BUYBACK" ? paymentMethod : undefined,
        })
        toast.success("Запись создана")
        router.push(`/trade-in/${result.id}`)
      } catch (err: any) {
        toast.error(err.message ?? "Ошибка создания записи")
      }
    })
  }, [currentStoreId, selectedCustomer, dealType, tradeInValues, paymentMethod, router])

  if (!currentStoreId) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Выберите магазин для оформления</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/trade-in")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-semibold">Новый трейд-ин / выкуп</h1>
      </div>

      {/* Section 1 — Customer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Клиент
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedCustomer ? (
            <div className="flex items-start justify-between rounded-lg border bg-muted/30 p-4">
              <div className="space-y-1">
                <p className="font-medium">{selectedCustomer.name}</p>
                <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
                {(selectedCustomer.passportSeries || selectedCustomer.passportNumber) && (
                  <p className="text-sm text-muted-foreground">
                    Паспорт:{" "}
                    {[selectedCustomer.passportSeries, selectedCustomer.passportNumber]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>
                Изменить
              </Button>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Поиск по имени или телефону..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Search results */}
              {customerResults.length > 0 && (
                <div className="rounded-md border divide-y">
                  {customerResults.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                      onClick={() => handleSelectCustomer(customer)}
                    >
                      <span className="font-medium">{customer.name}</span>
                      <span className="text-sm text-muted-foreground">{customer.phone}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* New customer */}
              {!showNewCustomerForm ? (
                <Button variant="outline" size="sm" onClick={() => setShowNewCustomerForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Новый клиент
                </Button>
              ) : (
                <div className="rounded-lg border p-4 space-y-4">
                  <p className="text-sm font-medium">Новый клиент</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>
                        ФИО <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        placeholder="Иванов Иван Иванович"
                        value={newCustomer.name}
                        onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Телефон <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        placeholder="+7 (900) 000-00-00"
                        value={newCustomer.phone}
                        onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Серия паспорта</Label>
                      <Input
                        placeholder="4510"
                        value={newCustomer.passportSeries}
                        onChange={(e) =>
                          setNewCustomer((p) => ({ ...p, passportSeries: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Номер паспорта</Label>
                      <Input
                        placeholder="123456"
                        value={newCustomer.passportNumber}
                        onChange={(e) =>
                          setNewCustomer((p) => ({ ...p, passportNumber: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Кем выдан</Label>
                      <Input
                        placeholder="ОВД района..."
                        value={newCustomer.passportIssuedBy}
                        onChange={(e) =>
                          setNewCustomer((p) => ({ ...p, passportIssuedBy: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Дата выдачи</Label>
                      <Input
                        type="date"
                        value={newCustomer.passportIssuedAt}
                        onChange={(e) =>
                          setNewCustomer((p) => ({ ...p, passportIssuedAt: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Комментарий</Label>
                      <Input
                        placeholder="Дополнительно..."
                        value={newCustomer.comment}
                        onChange={(e) => setNewCustomer((p) => ({ ...p, comment: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCreateCustomer} disabled={isCreatingCustomer}>
                      {isCreatingCustomer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Создать
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowNewCustomerForm(false)}>
                      Отмена
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Section 2+3 — Device, Pricing, Status via TradeInForm */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4" />
            Устройство и оценка
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tradeInValues ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">{tradeInValues.deviceType}</span>
                {tradeInValues.deviceBrand ? ` · ${tradeInValues.deviceBrand}` : ""}
                {tradeInValues.deviceModel ? ` ${tradeInValues.deviceModel}` : ""}
              </p>
              <p>Состояние: {tradeInValues.deviceCondition}</p>
              <p>
                Цена выкупа: {tradeInValues.agreedPrice} ₽ · Статус:{" "}
                {tradeInValues.initialStatus === "IN_STOCK"
                  ? "Готов к продаже"
                  : "Ожидает проверки"}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setTradeInValues(null)}>
                Изменить
              </Button>
            </div>
          ) : (
            <TradeInForm onSubmit={(values) => setTradeInValues(values)} />
          )}
        </CardContent>
      </Card>

      {/* Section 4 — Deal type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Тип сделки
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={dealType === "TRADE_IN" ? "default" : "outline"}
              onClick={() => setDealType("TRADE_IN")}
            >
              {TRADE_IN_TYPE_LABELS.TRADE_IN}
            </Button>
            <Button
              variant={dealType === "BUYBACK" ? "default" : "outline"}
              onClick={() => setDealType("BUYBACK")}
            >
              {TRADE_IN_TYPE_LABELS.BUYBACK}
            </Button>
          </div>

          {dealType === "BUYBACK" && (
            <div className="space-y-2">
              <Label>
                Способ выплаты <span className="text-destructive">*</span>
              </Label>
              <Select value={paymentMethod} onValueChange={(val) => setPaymentMethod(val ?? "")}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Выберите способ..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS)
                    .filter(([key]) => ["CASH", "CARD", "SBP", "TRANSFER"].includes(key))
                    .map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center gap-4 pb-6">
        <Button size="lg" disabled={isSubmitDisabled} onClick={handleSubmit}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Оформить
        </Button>
        <Button variant="ghost" onClick={() => router.push("/trade-in")}>
          Отмена
        </Button>
      </div>
    </div>
  )
}
