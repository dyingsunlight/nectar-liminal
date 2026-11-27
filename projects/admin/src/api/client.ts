import type {
  ApiResponse,
  BannerItem,
  Category,
  DashboardStats,
  Product,
  UpsertBannerInput,
  UpsertCategoryInput,
  UpsertProductInput,
} from '@nectar/shared'

export interface HealthInfo {
  status: string
  storageDriver: 'tablestore' | 'memory'
  timestamp: string
}

const STORAGE_URL_KEY = 'nectar_admin_api_url_override'
const STORAGE_TOKEN_KEY = 'nectar_admin_token'

export function getDefaultApiBaseUrl(): string {
  const override = localStorage.getItem(STORAGE_URL_KEY)
  if (override && override.trim()) {
    return override.trim().replace(/\/+$/, '')
  }
  const envUrl = import.meta.env.VITE_API_BASE_URL
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '')
  }
  return 'http://localhost:8787'
}

export function saveApiBaseUrlOverride(url: string): void {
  const normalized = url.trim().replace(/\/+$/, '')
  const envUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787').trim().replace(/\/+$/, '')
  if (!normalized || normalized === envUrl) {
    localStorage.removeItem(STORAGE_URL_KEY)
    return
  }
  localStorage.setItem(STORAGE_URL_KEY, normalized)
}

export function getDefaultAdminToken(): string {
  const saved = localStorage.getItem(STORAGE_TOKEN_KEY)
  if (saved !== null && saved.trim() !== '') {
    return saved.trim()
  }
  return import.meta.env.VITE_DEFAULT_ADMIN_TOKEN || 'dev-admin-token'
}

export function saveAdminToken(token: string): void {
  const trimmed = token.trim()
  if (!trimmed) {
    localStorage.removeItem(STORAGE_TOKEN_KEY)
    return
  }
  localStorage.setItem(STORAGE_TOKEN_KEY, trimmed)
}

export class AdminApiClient {
  constructor(
    public baseUrl: string,
    public adminToken: string
  ) {}

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const cleanBase = this.baseUrl.trim().replace(/\/+$/, '')
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Admin-Token': this.adminToken.trim(),
    }

    const init: RequestInit = {
      method,
      headers,
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }

    const response = await fetch(`${cleanBase}${path}`, init)
    const json = (await response.json().catch(() => null)) as ApiResponse<T> | null

    if (!response.ok || !json || json.code !== 0) {
      throw new Error(json?.message || `请求失败 (${response.status})`)
    }

    return json.data
  }

  health(): Promise<HealthInfo> {
    return this.request<HealthInfo>('GET', '/api/health')
  }

  stats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('GET', '/api/admin/stats')
  }

  seed(): Promise<{ categories: number; products: number; banners: number }> {
    return this.request('POST', '/api/admin/seed')
  }

  listProducts(categoryId?: string, keyword?: string): Promise<Product[]> {
    const params = new URLSearchParams()
    if (categoryId && categoryId !== 'all') {
      params.set('categoryId', categoryId)
    }
    if (keyword && keyword.trim()) {
      params.set('keyword', keyword.trim())
    }
    const qs = params.toString()
    return this.request<Product[]>('GET', `/api/products${qs ? `?${qs}` : ''}`)
  }

  saveProduct(input: UpsertProductInput): Promise<Product> {
    if (input.id) {
      return this.request<Product>(
        'PUT',
        `/api/admin/products/${encodeURIComponent(input.id)}`,
        input
      )
    }
    return this.request<Product>('POST', '/api/admin/products', input)
  }

  deleteProduct(id: string): Promise<{ id: string; deleted: boolean }> {
    return this.request('DELETE', `/api/admin/products/${encodeURIComponent(id)}`)
  }

  listCategories(): Promise<Category[]> {
    return this.request<Category[]>('GET', '/api/categories')
  }

  saveCategory(input: UpsertCategoryInput): Promise<Category> {
    if (input.id) {
      return this.request<Category>(
        'PUT',
        `/api/admin/categories/${encodeURIComponent(input.id)}`,
        input
      )
    }
    return this.request<Category>('POST', '/api/admin/categories', input)
  }

  deleteCategory(id: string): Promise<{ id: string; deleted: boolean }> {
    return this.request('DELETE', `/api/admin/categories/${encodeURIComponent(id)}`)
  }

  listBanners(): Promise<BannerItem[]> {
    return this.request<BannerItem[]>('GET', '/api/home').then((home) => {
      const data = home as unknown as { banners?: BannerItem[] }
      return data.banners ?? []
    })
  }

  saveBanner(input: UpsertBannerInput): Promise<BannerItem> {
    if (input.id) {
      return this.request<BannerItem>(
        'PUT',
        `/api/admin/banners/${encodeURIComponent(input.id)}`,
        input
      )
    }
    return this.request<BannerItem>('POST', '/api/admin/banners', input)
  }

  deleteBanner(id: string): Promise<{ id: string; deleted: boolean }> {
    return this.request('DELETE', `/api/admin/banners/${encodeURIComponent(id)}`)
  }
}
