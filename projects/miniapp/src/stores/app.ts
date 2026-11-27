import { defineStore } from 'pinia'

interface AppState {
  pendingCategoryId: string | null
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    pendingCategoryId: null,
  }),

  actions: {
    setPendingCategory(id: string) {
      this.pendingCategoryId = id
    },

    consumePendingCategory(): string | null {
      const next = this.pendingCategoryId
      this.pendingCategoryId = null
      return next
    },
  },
})
