import type {
  AuthLoginResult,
  BannerItem,
  Category,
  Product,
  ProductQueryParams,
  UpdateUserProfileInput,
  UpsertBannerInput,
  UpsertCategoryInput,
  UpsertProductInput,
  UserProfile,
} from '@nectar/shared'

export interface SeedResult {
  categories: number
  products: number
  banners: number
}

export interface Repository {
  readonly driver: 'tablestore' | 'memory'
  listCategories(): Promise<Category[]>
  upsertCategory(input: UpsertCategoryInput): Promise<Category>
  deleteCategory(id: string): Promise<boolean>
  listProducts(params?: ProductQueryParams): Promise<Product[]>
  getProduct(id: string): Promise<Product | null>
  upsertProduct(input: UpsertProductInput): Promise<Product>
  deleteProduct(id: string): Promise<boolean>
  listBanners(): Promise<BannerItem[]>
  upsertBanner(input: UpsertBannerInput): Promise<BannerItem>
  deleteBanner(id: string): Promise<boolean>
  getUser(openId: string): Promise<UserProfile | null>
  loginUser(openId: string): Promise<AuthLoginResult>
  updateUser(openId: string, input: UpdateUserProfileInput): Promise<UserProfile | null>
  seed(): Promise<SeedResult>
}
