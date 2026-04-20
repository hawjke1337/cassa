import { fetchAuditLogs } from "@/actions/audit"
import { AuditLogTable } from "@/components/settings/audit-log-table"

export default async function AuditLogPage() {
  const data = await fetchAuditLogs({})
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Журнал аудита</h2>
        <p className="text-muted-foreground">История всех изменений в системе</p>
      </div>
      <AuditLogTable initialData={data} />
    </div>
  )
}
