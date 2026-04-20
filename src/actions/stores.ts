"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function getUserStores() {
  const session = await auth()
  if (!session?.user?.id) return []

  const userStores = await db.userStore.findMany({
    where: { userId: session.user.id },
    include: { store: true },
  })

  return userStores.map((us) => ({
    id: us.store.id,
    name: us.store.name,
  }))
}
