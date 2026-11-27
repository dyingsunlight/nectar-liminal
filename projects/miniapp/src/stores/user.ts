import { defineStore } from 'pinia'
import { getUserProfile, loginWithWechat, updateUserProfile } from '@/services'
import type { AuthLoginResult, UpdateUserProfileInput, UserProfile } from '@/types/mall'

const STORAGE_KEY = 'suwu_user_session_v1'

interface StoredSession {
  isLoggedIn: boolean
  profile: UserProfile
}

interface UserState {
  isLoggedIn: boolean
  profile: UserProfile | null
  hydrated: boolean
  loading: boolean
}

function readStorage(): StoredSession | null {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    const parsed =
      typeof raw === 'string' && raw ? (JSON.parse(raw) as unknown) : (raw as unknown)
    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }
    const candidate = parsed as Partial<StoredSession>
    if (
      candidate.isLoggedIn === true &&
      candidate.profile &&
      typeof candidate.profile.id === 'string' &&
      candidate.profile.id.length > 0
    ) {
      return {
        isLoggedIn: true,
        profile: candidate.profile,
      }
    }
  } catch (err) {
    console.warn('[UserStore] Failed to hydrate from storage:', err)
  }
  return null
}

function writeStorage(isLoggedIn: boolean, profile: UserProfile | null): void {
  try {
    if (isLoggedIn && profile) {
      uni.setStorageSync(STORAGE_KEY, {
        isLoggedIn: true,
        profile,
      })
    } else {
      uni.removeStorageSync(STORAGE_KEY)
    }
  } catch (err) {
    console.warn('[UserStore] Failed to persist to storage:', err)
  }
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    isLoggedIn: false,
    profile: null,
    hydrated: false,
    loading: false,
  }),

  actions: {
    hydrate() {
      if (this.hydrated) return
      const stored = readStorage()
      if (stored) {
        this.isLoggedIn = true
        this.profile = stored.profile
      } else {
        this.isLoggedIn = false
        this.profile = null
      }
      this.hydrated = true
    },

    persist() {
      writeStorage(this.isLoggedIn, this.profile)
    },

    async login(): Promise<AuthLoginResult> {
      this.loading = true
      try {
        const res = await loginWithWechat()
        if (res.code !== 0 || !res.data?.profile) {
          throw new Error(res.message || '微信登录失败')
        }
        this.profile = res.data.profile
        this.isLoggedIn = true
        this.hydrated = true
        this.persist()
        return res.data
      } finally {
        this.loading = false
      }
    },

    async refreshProfile(): Promise<UserProfile | null> {
      this.hydrate()
      if (!this.isLoggedIn) {
        return null
      }
      const res = await getUserProfile()
      if (res.code === 0 && res.data) {
        this.profile = res.data
        this.persist()
        return res.data
      }
      if (res.code === 401 || res.code === 404) {
        this.logout()
        return null
      }
      throw new Error(res.message || '获取用户信息失败')
    },

    async updateProfile(input: UpdateUserProfileInput): Promise<UserProfile> {
      this.loading = true
      try {
        const res = await updateUserProfile(input)
        if (res.code === 401 || res.code === 404) {
          this.logout()
          throw new Error(res.message || '登录态已失效，请重新登录')
        }
        if (res.code !== 0 || !res.data) {
          throw new Error(res.message || '保存资料失败')
        }
        this.profile = res.data
        this.isLoggedIn = true
        this.hydrated = true
        this.persist()
        return res.data
      } finally {
        this.loading = false
      }
    },

    logout() {
      this.isLoggedIn = false
      this.profile = null
      this.hydrated = true
      writeStorage(false, null)
    },
  },
})
