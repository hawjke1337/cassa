import { db } from "@/lib/db"
import type { SerialUnitEvent, RelatedDocType } from "@/generated/prisma/client"

type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0]

export async function writeSerialHistory(
  tx: TxClient,
  data: {
    serialUnitId: string
    event: SerialUnitEvent
    storeId: string
    performedById: string
    relatedDocument?: string
    relatedDocType?: RelatedDocType
    comment?: string
  }
) {
  return tx.serialUnitHistory.create({
    data: {
      serialUnitId: data.serialUnitId,
      event: data.event,
      storeId: data.storeId,
      performedById: data.performedById,
      relatedDocument: data.relatedDocument ?? null,
      relatedDocType: data.relatedDocType ?? null,
      comment: data.comment ?? null,
    },
  })
}
