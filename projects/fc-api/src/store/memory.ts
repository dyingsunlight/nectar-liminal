import { randomUUID } from 'node:crypto'
import {
  SEED_BANNERS,
  SEED_CATEGORIES,
  SEED_PRODUCTS,
  type AuthLoginResult,
  type BannerItem,
  type Category,
  type Product,
  type ProductQueryParams,
  type UpdateUserProfileInput,
  type UpsertBannerInput,
  type UpsertCategoryInput,
  type UpsertProductInput,
  type UserProfile,
} from '@nectar/shared'
import type { Repository, SeedResult } from './repository'
import {
  applyUserProfileUpdate,
  createDefaultUser,
  normalizeUserProfile,
} from './user-helpers'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export class MemoryRepository implements Repository {
  readonly driver = 'memory' as const
  private readonly categories = new Map<string, Category>()
  private readonly products = new Map<string, Product>()
  private readonly banners = new Map<string, BannerItem>()
  private readonly users = new Map<string, UserProfile>()

  constructor() {
    this.loadSeedSync()
  }

  private loadSeedSync(): SeedResult {
    for (const category of SEED_CATEGORIES) {
      this.categories.set(category.id, clone(category))
    }
    for (const product of SEED_PRODUCTS) {
      this.products.set(product.id, clone(product))
    }
    for (const banner of SEED_BANNERS) {
      this.banners.set(banner.id, clone(banner))
    }
    return {
      categories: SEED_CATEGORIES.length,
      products: SEED_PRODUCTS.length,
      banners: SEED_BANNERS.length,
    }
  }

  async listCategories(): Promise<Category[]> {
    return Array.from(this.categories.values()).map(clone)
  }

  async upsertCategory(input: UpsertCategoryInput): Promise<Category> {
    const id = input.id?.trim() || `cat-${randomUUID().slice(0, 8)}`
    const record: Category = {
      id,
      name: input.name.trim(),
      enName: input.enName.trim(),
      description: input.description.trim(),
    }
    this.categories.set(id, record)
    return clone(record)
  }

  async deleteCategory(id: string): Promise<boolean> {
    return this.categories.delete(id)
  }

  async listProducts(params?: ProductQueryParams): Promise<Product[]> {
    let items = Array.from(this.products.values())
    if (params?.categoryId && params.categoryId !== 'all') {
      items = items.filter((item) => item.categoryId === params.categoryId)
    }
    if (params?.keyword?.trim()) {
      const kw = params.keyword.trim().toLowerCase()
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(kw) ||
          item.subtitle.toLowerCase().includes(kw) ||
          item.description.toLowerCase().includes(kw)
      )
    }
    return items.map(clone)
  }

  async getProduct(id: string): Promise<Product | null> {
    const found = this.products.get(id)
    return found ? clone(found) : null
  }

  async upsertProduct(input: UpsertProductInput): Promise<Product> {
    const id = input.id?.trim() || `prod-${randomUUID().slice(0, 8)}`
    const record: Product = {
      id,
      categoryId: input.categoryId.trim(),
      title: input.title.trim(),
      subtitle: input.subtitle.trim(),
      price: Number(input.price),
      originalPrice:
        input.originalPrice !== undefined && input.originalPrice !== null
          ? Number(input.originalPrice)
          : undefined,
      unit: input.unit.trim(),
      tag: input.tag?.trim() || undefined,
      tone: input.tone.trim() || '#E6DDD3',
      spec: input.spec.trim(),
      stock: Math.max(0, Math.trunc(Number(input.stock))),
      isFeatured: Boolean(input.isFeatured),
      coverUrl: input.coverUrl?.trim() || '',
      description: input.description.trim(),
    }
    this.products.set(id, record)
    return clone(record)
  }

  async deleteProduct(id: string): Promise<boolean> {
    return this.products.delete(id)
  }

  async listBanners(): Promise<BannerItem[]> {
    return Array.from(this.banners.values()).map(clone)
  }

  async upsertBanner(input: UpsertBannerInput): Promise<BannerItem> {
    const id = input.id?.trim() || `banner-${randomUUID().slice(0, 8)}`
    const record: BannerItem = {
      id,
      title: input.title.trim(),
      subtitle: input.subtitle.trim(),
      tag: input.tag.trim(),
      tone: input.tone.trim() || '#E4DAD0',
      coverUrl: input.coverUrl?.trim() || '',
      targetProductId: input.targetProductId?.trim() || undefined,
    }
    this.banners.set(id, record)
    return clone(record)
  }

  async deleteBanner(id: string): Promise<boolean> {
    return this.banners.delete(id)
  }

  async getUser(openId: string): Promise<UserProfile | null> {
    const key = openId.trim()
    if (!key) return null
    const existing = this.users.get(key)
    if (!existing) return null
    return clone(normalizeUserProfile(key, existing, new Date().toISOString()))
  }

  async loginUser(openId: string): Promise<AuthLoginResult> {
    const key = openId.trim()
    if (!key) {
      throw new Error('openId 不能为空')
    }
    const nowIso = new Date().toISOString()
    const existing = this.users.get(key)
    if (existing) {
      const updated: UserProfile = {
        ...normalizeUserProfile(key, existing, nowIso),
        lastLoginAt: nowIso,
      }
      this.users.set(key, updated)
      return {
        profile: clone(updated),
        isNewUser: false,
      }
    }
    const created = createDefaultUser(key, nowIso)
    this.users.set(key, created)
    return {
      profile: clone(created),
      isNewUser: true,
    }
  }

  async updateUser(
    openId: string,
    input: UpdateUserProfileInput
  ): Promise<UserProfile | null> {
    const key = openId.trim()
    if (!key) return null
    const existing = this.users.get(key)
    if (!existing) return null
    const nowIso = new Date().toISOString()
    const updated = applyUserProfileUpdate(key, existing, input, nowIso)
    this.users.set(key, updated)
    return clone(updated)
  }

  async seed(): Promise<SeedResult> {
    return this.loadSeedSync()
  }
}
