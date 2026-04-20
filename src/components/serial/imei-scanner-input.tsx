"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { isValidImei } from "@/lib/imei-utils"

interface ImeiScannerInputProps {
  identifierType: "IMEI" | "SN" | "BOTH"
  fieldName: "imei" | "imei2" | "serialNumber"
  value: string
  onChange: (value: string) => void
  onEnter?: () => void
  autoFocus?: boolean
  placeholder?: string
}

export function ImeiScannerInput({
  identifierType,
  fieldName,
  value,
  onChange,
  onEnter,
  autoFocus,
  placeholder,
}: ImeiScannerInputProps) {
  const [error, setError] = useState("")

  const validate = (v: string) => {
    if (!v) {
      setError("")
      return
    }
    // INV-06: строгая Luhn+15digits валидация только для identifierType="IMEI".
    // Для "BOTH" (dual-SIM) поле imei может содержать нестандартные серийники —
    // поэтому не применяем Luhn. Для "SN" поле вообще не должно быть IMEI-полем.
    if (identifierType === "IMEI" && (fieldName === "imei" || fieldName === "imei2")) {
      if (!/^\d{15}$/.test(v)) {
        setError("IMEI должен содержать 15 цифр")
        return
      }
      if (!isValidImei(v)) {
        setError("Некорректная контрольная сумма IMEI (Luhn)")
        return
      }
    }
    // SN or BOTH: no format restriction, any non-empty string is valid
    setError("")
  }

  return (
    <div>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          validate(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !error && value) onEnter?.()
        }}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={error ? "border-red-500 h-8" : "h-8"}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
