import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return Response.json({ status: "ok" }, { status: 200 })
  } catch {
    return Response.json({ status: "error" }, { status: 503 })
  }
}
