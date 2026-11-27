export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface BannerItem {
  id: string
  title: string
  subtitle: string
  tag: string
  tone: string
  coverUrl?: string
  targetProductId?: string
}

export interface Category {
  id: string
  name: string
  enName: string
  description: string
}

export interface Product {
  id: string
  categoryId: string
  title: string
  subtitle: string
  price: number
  originalPrice?: number
  unit: string
  tag?: string
  tone: string
  spec: string
  stock: number
  isFeatured?: boolean
  coverUrl?: string
  description: string
}

export interface HomeData {
  banners: BannerItem[]
  categories: Category[]
  featuredProducts: Product[]
}

export interface CartItem {
  productId: string
  title: string
  spec: string
  price: number
  tone: string
  coverUrl?: string
  quantity: number
  checked: boolean
}

export interface UserOrderStats {
  unpaid: number
  unshipped: number
  shipped: number
  afterSale: number
}

export interface UserProfile {
  id: string
  nickname: string
  memberLevel: string
  avatarText: string
  avatarUrl?: string
  stats: UserOrderStats
  points: number
  couponCount: number
  createdAt: string
  lastLoginAt: string
}

export interface AuthLoginResult {
  profile: UserProfile
  isNewUser: boolean
}

export interface UpdateUserProfileInput {
  nickname?: string
  avatarUrl?: string
}

export interface ProductQueryParams {
  categoryId?: string
  keyword?: string
}

export interface UpsertProductInput {
  id?: string
  categoryId: string
  title: string
  subtitle: string
  price: number
  originalPrice?: number
  unit: string
  tag?: string
  tone: string
  spec: string
  stock: number
  isFeatured?: boolean
  coverUrl?: string
  description: string
}

export interface UpsertCategoryInput {
  id?: string
  name: string
  enName: string
  description: string
}

export interface UpsertBannerInput {
  id?: string
  title: string
  subtitle: string
  tag: string
  tone: string
  coverUrl?: string
  targetProductId?: string
}

export interface DashboardStats {
  productCount: number
  categoryCount: number
  bannerCount: number
  featuredCount: number
  totalStock: number
  storageDriver: 'tablestore' | 'memory'
}
