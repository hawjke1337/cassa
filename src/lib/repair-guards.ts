import type { RepairStatus } from "@/generated/prisma/client"

/**
 * REPAIR-06: Cost freeze guard.
 * Запрещает изменение стоимости после завершения ремонта (COMPLETED/DELIVERED).
 */
export function assertCostNotFrozen(status: RepairStatus): void {
  if (status === "COMPLETED" || status === "DELIVERED") {
    throw new Error("Нельзя изменить стоимость после завершения ремонта")
  }
}
