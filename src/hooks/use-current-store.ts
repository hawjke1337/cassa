import { create } from "zustand"
import { persist } from "zustand/middleware"

interface StoreState {
  currentStoreId: string | null
  currentStoreName: string | null
  setCurrentStore: (id: string, name: string) => void
}

export const useCurrentStore = create<StoreState>()(
  persist(
    (set) => ({
      currentStoreId: null,
      currentStoreName: null,
      setCurrentStore: (id, name) => set({ currentStoreId: id, currentStoreName: name }),
    }),
    { name: "astore-current-store" }
  )
)
