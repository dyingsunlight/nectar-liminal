import { defineStore } from 'pinia'
import type { CartItem, Product } from '@/types/mall'

const STORAGE_KEY = 'suwu_cart_v1'

interface CartState {
  items: CartItem[]
  hydrated: boolean
}

function readStorage(): CartItem[] {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string' && raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    }
  } catch (err) {
    console.warn('[CartStore] Failed to hydrate from storage:', err)
  }
  return []
}

function writeStorage(items: CartItem[]) {
  try {
    uni.setStorageSync(STORAGE_KEY, items)
  } catch (err) {
    console.warn('[CartStore] Failed to persist to storage:', err)
  }
}

export const useCartStore = defineStore('cart', {
  state: (): CartState => ({
    items: [],
    hydrated: false,
  }),

  getters: {
    totalCount: (state): number =>
      state.items.reduce((sum, item) => sum + item.quantity, 0),

    checkedCount: (state): number =>
      state.items
        .filter((item) => item.checked)
        .reduce((sum, item) => sum + item.quantity, 0),

    checkedTotalPrice: (state): number =>
      state.items
        .filter((item) => item.checked)
        .reduce((sum, item) => sum + item.price * item.quantity, 0),

    isAllChecked: (state): boolean =>
      state.items.length > 0 && state.items.every((item) => item.checked),
  },

  actions: {
    hydrate() {
      if (this.hydrated) return
      this.items = readStorage()
      this.hydrated = true
    },

    persist() {
      writeStorage(this.items)
    },

    addItem(product: Product) {
      this.hydrate()
      const existing = this.items.find((item) => item.productId === product.id)
      if (existing) {
        existing.quantity += 1
        existing.checked = true
      } else {
        this.items.unshift({
          productId: product.id,
          title: product.title,
          spec: product.spec,
          price: product.price,
          tone: product.tone,
          coverUrl: product.coverUrl,
          quantity: 1,
          checked: true,
        })
      }
      this.persist()
    },

    updateQuantity(productId: string, delta: number) {
      this.hydrate()
      const target = this.items.find((item) => item.productId === productId)
      if (!target) return
      const next = target.quantity + delta
      if (next <= 0) {
        this.removeItem(productId)
        return
      }
      target.quantity = next
      this.persist()
    },

    toggleItem(productId: string) {
      this.hydrate()
      const target = this.items.find((item) => item.productId === productId)
      if (!target) return
      target.checked = !target.checked
      this.persist()
    },

    toggleAll(checked: boolean) {
      this.hydrate()
      this.items.forEach((item) => {
        item.checked = checked
      })
      this.persist()
    },

    removeItem(productId: string) {
      this.hydrate()
      this.items = this.items.filter((item) => item.productId !== productId)
      this.persist()
    },

    clearChecked() {
      this.hydrate()
      this.items = this.items.filter((item) => !item.checked)
      this.persist()
    },
  },
})
