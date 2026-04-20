import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface CartItem {
  productId: string
  name: string
  sku: string
  price: number
  costPrice: number
  quantity: number
  discount: number
  maxStock: number
  total: number
  serialUnitId?: string | null
  imei?: string | null
}

interface CartState {
  items: CartItem[]
  addItem: (product: Omit<CartItem, "quantity" | "discount" | "total">) => void
  removeItem: (productId: string, serialUnitId?: string | null) => void
  updateQuantity: (productId: string, quantity: number, serialUnitId?: string | null) => void
  applyDiscount: (productId: string, discount: number, serialUnitId?: string | null) => void
  clearCart: () => void
  getTotal: () => number
  getDiscountTotal: () => number
  getItemCount: () => number
}

function calcTotal(item: Pick<CartItem, "price" | "discount" | "quantity">): number {
  return +((item.price - item.discount) * item.quantity).toFixed(2)
}

function matchItem(item: CartItem, productId: string, serialUnitId?: string | null): boolean {
  if (serialUnitId) {
    return item.serialUnitId === serialUnitId
  }
  return item.productId === productId && !item.serialUnitId
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product) => {
        set((state) => {
          // Serialized items (with serialUnitId) always add as separate line
          if (product.serialUnitId) {
            // Guard against duplicate serial unit
            const duplicate = state.items.find((i) => i.serialUnitId === product.serialUnitId)
            if (duplicate) return state

            const newItem: CartItem = {
              ...product,
              quantity: 1,
              discount: 0,
              total: product.price,
            }
            return { items: [...state.items, newItem] }
          }

          // Non-serialized: merge by productId
          const existing = state.items.find(
            (i) => i.productId === product.productId && !i.serialUnitId,
          )
          if (existing) {
            const newQty = Math.min(existing.quantity + 1, existing.maxStock)
            return {
              items: state.items.map((i) =>
                i.productId === product.productId && !i.serialUnitId
                  ? { ...i, quantity: newQty, total: calcTotal({ ...i, quantity: newQty }) }
                  : i,
              ),
            }
          }
          const newItem: CartItem = {
            ...product,
            quantity: 1,
            discount: 0,
            total: product.price,
          }
          return { items: [...state.items, newItem] }
        })
      },

      removeItem: (productId, serialUnitId) => {
        set((state) => ({
          items: state.items.filter((i) => !matchItem(i, productId, serialUnitId)),
        }))
      },

      updateQuantity: (productId, quantity, serialUnitId) => {
        set((state) => ({
          items: state.items.map((i) => {
            if (!matchItem(i, productId, serialUnitId)) return i
            const clamped = Math.max(1, Math.min(quantity, i.maxStock))
            return { ...i, quantity: clamped, total: calcTotal({ ...i, quantity: clamped }) }
          }),
        }))
      },

      applyDiscount: (productId, discount, serialUnitId) => {
        set((state) => ({
          items: state.items.map((i) => {
            if (!matchItem(i, productId, serialUnitId)) return i
            const clamped = Math.max(0, Math.min(discount, i.price))
            return { ...i, discount: clamped, total: calcTotal({ ...i, discount: clamped }) }
          }),
        }))
      },

      clearCart: () => set({ items: [] }),

      getTotal: () => {
        return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0)
      },

      getDiscountTotal: () => {
        return get().items.reduce((sum, i) => sum + i.discount * i.quantity, 0)
      },

      getItemCount: () => {
        return get().items.reduce((sum, i) => sum + i.quantity, 0)
      },
    }),
    { name: "astore-pos-cart", version: 1 },
  ),
)
