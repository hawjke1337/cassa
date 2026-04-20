import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkPermission } from "@/lib/permissions"
import { PrintLayout } from "@/components/print/print-layout"
import { formatMoney } from "@/lib/format"

interface PrintShiftPageProps {
  params: Promise<{ id: string }>
}

export default async function PrintShiftPage({ params }: PrintShiftPageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const shift = await db.shift.findUnique({
    where: { id },
    include: {
      store: { select: { id: true, name: true } },
      openedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  if (!shift) redirect("/shifts")

  // Permission check
  const canViewAll = await checkPermission("shifts.view_all", shift.store.id)
  const canView = await checkPermission("shifts.view", shift.store.id)
  if (!canViewAll && !canView) redirect("/shifts")
  if (!canViewAll && shift.openedBy.id !== session.user.id) redirect("/shifts")

  const date = shift.openedAt.toLocaleDateString("ru-RU")
  const employeeName = `${shift.openedBy.firstName} ${shift.openedBy.lastName}`

  return (
    <PrintLayout title={`Смена ${shift.number}`}>
      <div className="p-8 font-mono text-sm">
        <div className="mb-6 flex justify-between">
          <div>
            <p className="text-lg font-bold">{shift.store.name}</p>
            <p>Дата: {date}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">Смена №{shift.number}</p>
            <p>Продавец: {employeeName}</p>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Opening stub */}
          <div className="flex-1 rounded border-2 border-dashed border-gray-400 p-6">
            <p className="mb-4 text-center font-bold">ОТКРЫТИЕ СМЕНЫ</p>
            <p>Наличные: {formatMoney(Number(shift.openingCash))}</p>
            <div className="mt-8 border-t border-gray-300 pt-2 text-center text-xs text-gray-500">
              (место для чека)
            </div>
            <div className="h-40" />
          </div>

          {/* Closing stub */}
          <div className="flex-1 rounded border-2 border-dashed border-gray-400 p-6">
            <p className="mb-4 text-center font-bold">ЗАКРЫТИЕ СМЕНЫ</p>
            {shift.closingCash !== null ? (
              <>
                <p>Наличные: {formatMoney(Number(shift.closingCash))}</p>
                <p>Ожидалось: {formatMoney(Number(shift.expectedCash))}</p>
                <p>
                  Расхождение:{" "}
                  {shift.discrepancy !== null
                    ? formatMoney(Number(shift.discrepancy))
                    : "—"}
                </p>
              </>
            ) : (
              <p className="text-gray-500">—</p>
            )}
            <div className="mt-8 border-t border-gray-300 pt-2 text-center text-xs text-gray-500">
              (место для чека)
            </div>
            <div className="h-40" />
          </div>
        </div>
      </div>
    </PrintLayout>
  )
}
