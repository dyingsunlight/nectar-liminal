import { createHash, timingSafeEqual } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import {
  HEADER_ADMIN_TOKEN,
  HEADER_DEV_OPENID,
  HEADER_PROXY_TOKEN,
  HEADER_WX_OPENID,
  type ApiResponse,
  type DashboardStats,
  type UpdateUserProfileInput,
  type UpsertBannerInput,
  type UpsertCategoryInput,
  type UpsertProductInput,
} from '@nectar/shared'
import { getRepository } from './store'

function matchOriginPattern(origin: string, pattern: string): boolean {
  if (pattern === '*') {
    return true
  }
  if (!pattern.includes('*')) {
    return origin === pattern
  }
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]+')
  const regex = new RegExp(`^${escaped}$`)
  return regex.test(origin)
}

function resolveAllowedOrigin(origin: string | undefined): string | null {
  const configured = (process.env.CORS_ALLOW_ORIGINS || '*')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (configured.includes('*')) {
    return '*'
  }
  if (!origin) {
    return null
  }
  for (const pattern of configured) {
    if (matchOriginPattern(origin, pattern)) {
      return origin
    }
  }
  return null
}

function secureEquals(expected: string, actual: string): boolean {
  const expectedDigest = createHash('sha256').update(expected).digest()
  const actualDigest = createHash('sha256').update(actual).digest()
  return timingSafeEqual(expectedDigest, actualDigest)
}

function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  const body: ApiResponse<T> = {
    code: 0,
    message: 'ok',
    data,
  }
  return c.json(body, status)
}

function fail(c: Context, message: string, status: 400 | 401 | 403 | 404 | 500 = 400) {
  const body: ApiResponse<null> = {
    code: status,
    message,
    data: null,
  }
  return c.json(body, status)
}

function extractAdminToken(c: Context): string {
  const headerToken = c.req.header(HEADER_ADMIN_TOKEN)
  if (headerToken) {
    return headerToken.trim()
  }
  const auth = c.req.header('authorization')
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim()
  }
  return ''
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`字段 ${field} 不能为空`)
  }
  return value.trim()
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function asNumber(value: unknown, field: string): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`字段 ${field} 必须是有效非负数字`)
  }
  return num
}

function parseProductInput(raw: unknown, idOverride?: string): UpsertProductInput {
  if (!isPlainObject(raw)) {
    throw new Error('请求体必须是 JSON 对象')
  }
  const originalPrice =
    raw.originalPrice !== undefined && raw.originalPrice !== null && raw.originalPrice !== ''
      ? asNumber(raw.originalPrice, 'originalPrice')
      : undefined
  return {
    id: idOverride ?? asOptionalString(raw.id),
    categoryId: asRequiredString(raw.categoryId, 'categoryId'),
    title: asRequiredString(raw.title, 'title'),
    subtitle: asRequiredString(raw.subtitle, 'subtitle'),
    price: asNumber(raw.price, 'price'),
    originalPrice,
    unit: asRequiredString(raw.unit, 'unit'),
    tag: asOptionalString(raw.tag),
    tone: asOptionalString(raw.tone) ?? '#E6DDD3',
    spec: asRequiredString(raw.spec, 'spec'),
    stock: raw.stock === undefined ? 0 : asNumber(raw.stock, 'stock'),
    isFeatured: Boolean(raw.isFeatured),
    coverUrl: asOptionalString(raw.coverUrl) ?? '',
    description: asRequiredString(raw.description, 'description'),
  }
}

function parseCategoryInput(raw: unknown, idOverride?: string): UpsertCategoryInput {
  if (!isPlainObject(raw)) {
    throw new Error('请求体必须是 JSON 对象')
  }
  return {
    id: idOverride ?? asOptionalString(raw.id),
    name: asRequiredString(raw.name, 'name'),
    enName: asRequiredString(raw.enName, 'enName'),
    description: asRequiredString(raw.description, 'description'),
  }
}

function parseBannerInput(raw: unknown, idOverride?: string): UpsertBannerInput {
  if (!isPlainObject(raw)) {
    throw new Error('请求体必须是 JSON 对象')
  }
  return {
    id: idOverride ?? asOptionalString(raw.id),
    title: asRequiredString(raw.title, 'title'),
    subtitle: asRequiredString(raw.subtitle, 'subtitle'),
    tag: asRequiredString(raw.tag, 'tag'),
    tone: asOptionalString(raw.tone) ?? '#E4DAD0',
    coverUrl: asOptionalString(raw.coverUrl) ?? '',
    targetProductId: asOptionalString(raw.targetProductId),
  }
}

const MAX_AVATAR_DATA_URI_BYTES = 100 * 1024
const AVATAR_DATA_URI_REGEX =
  /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/

function isValidAvatarUrl(value: string): boolean {
  if (value === '') {
    return true
  }
  if (AVATAR_DATA_URI_REGEX.test(value)) {
    return value.length <= MAX_AVATAR_DATA_URI_BYTES
  }
  if (value.startsWith('https://') && value.length <= 1024) {
    try {
      return new URL(value).protocol === 'https:'
    } catch {
      return false
    }
  }
  return false
}

function parseUpdateUserProfileInput(raw: unknown): UpdateUserProfileInput {
  if (!isPlainObject(raw)) {
    throw new Error('请求体必须是 JSON 对象')
  }
  if (raw.nickname === undefined && raw.avatarUrl === undefined) {
    throw new Error('字段 nickname 和 avatarUrl 不能同时为空')
  }

  const input: UpdateUserProfileInput = {}
  if (raw.nickname !== undefined) {
    if (typeof raw.nickname !== 'string') {
      throw new Error('字段 nickname 长度需在 1-32 个字符之间')
    }
    const trimmed = raw.nickname.trim()
    if (trimmed.length < 1 || trimmed.length > 32) {
      throw new Error('字段 nickname 长度需在 1-32 个字符之间')
    }
    input.nickname = trimmed
  }

  if (raw.avatarUrl !== undefined) {
    if (typeof raw.avatarUrl !== 'string') {
      throw new Error(
        '字段 avatarUrl 必须是 HTTPS 链接或不超过 100KB 的图片 Base64 Data URI'
      )
    }
    const trimmed = raw.avatarUrl.trim()
    if (!isValidAvatarUrl(trimmed)) {
      throw new Error(
        '字段 avatarUrl 必须是 HTTPS 链接或不超过 100KB 的图片 Base64 Data URI'
      )
    }
    input.avatarUrl = trimmed
  }

  return input
}

function resolveUserOpenId(
  c: Context
): { openId: string } | { error: string; status: 401 } {
  const expectedSecret = process.env.PROXY_SHARED_SECRET?.trim()
  if (expectedSecret) {
    const provided = c.req.header(HEADER_PROXY_TOKEN)?.trim() || ''
    if (!provided || !secureEquals(expectedSecret, provided)) {
      return { error: '无效的代理网关令牌', status: 401 }
    }
    const openId = c.req.header(HEADER_WX_OPENID)?.trim() || ''
    if (!openId) {
      return { error: '缺少微信用户身份标识，请通过小程序登录', status: 401 }
    }
    return { openId }
  }

  const openId =
    c.req.header(HEADER_WX_OPENID)?.trim() ||
    c.req.header(HEADER_DEV_OPENID)?.trim() ||
    ''
  if (!openId) {
    return {
      error: '缺少用户身份标识，请在本地调试时传递 X-Dev-Openid 或通过微信云函数调用',
      status: 401,
    }
  }
  return { openId }
}

export function createApp() {
  const app = new Hono()

  app.use(
    '/*',
    cors({
      origin: (origin) => resolveAllowedOrigin(origin),
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: [
        'Content-Type',
        'Authorization',
        'X-Admin-Token',
        'X-Proxy-Token',
        'X-Dev-Openid',
        'X-Requested-With',
      ],
      maxAge: 86400,
    })
  )

  app.get('/api/health', (c) => {
    const repo = getRepository()
    return ok(c, {
      status: 'ok',
      storageDriver: repo.driver,
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/api/home', async (c) => {
    const repo = getRepository()
    const [banners, categories, allProducts] = await Promise.all([
      repo.listBanners(),
      repo.listCategories(),
      repo.listProducts(),
    ])
    const featuredProducts = allProducts.filter((item) => item.isFeatured)
    return ok(c, {
      banners,
      categories,
      featuredProducts,
    })
  })

  app.get('/api/categories', async (c) => {
    const repo = getRepository()
    const categories = await repo.listCategories()
    return ok(c, categories)
  })

  app.get('/api/products', async (c) => {
    const repo = getRepository()
    const categoryId = c.req.query('categoryId')
    const keyword = c.req.query('keyword')
    const products = await repo.listProducts({ categoryId, keyword })
    return ok(c, products)
  })

  app.get('/api/products/:id', async (c) => {
    const repo = getRepository()
    const id = c.req.param('id')
    const product = await repo.getProduct(id)
    if (!product) {
      return fail(c, '未找到该商品', 404)
    }
    return ok(c, product)
  })

  app.post('/api/auth/login', async (c) => {
    const auth = resolveUserOpenId(c)
    if ('error' in auth) {
      return fail(c, auth.error, auth.status)
    }
    const repo = getRepository()
    const result = await repo.loginUser(auth.openId)
    return ok(c, result)
  })

  app.get('/api/me', async (c) => {
    const auth = resolveUserOpenId(c)
    if ('error' in auth) {
      return fail(c, auth.error, auth.status)
    }
    const repo = getRepository()
    const profile = await repo.getUser(auth.openId)
    if (!profile) {
      return fail(c, '尚未登录，请先完成微信登录', 404)
    }
    return ok(c, profile)
  })

  app.put('/api/me', async (c) => {
    const auth = resolveUserOpenId(c)
    if ('error' in auth) {
      return fail(c, auth.error, auth.status)
    }
    const raw = await c.req.json().catch(() => null)
    const input = parseUpdateUserProfileInput(raw)
    const repo = getRepository()
    const updated = await repo.updateUser(auth.openId, input)
    if (!updated) {
      return fail(c, '用户不存在，请先完成微信登录', 404)
    }
    return ok(c, updated)
  })

  app.use('/api/admin/*', async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      return next()
    }
    const expectedToken = (process.env.ADMIN_API_TOKEN || 'dev-admin-token').trim()
    const providedToken = extractAdminToken(c)
    if (!providedToken || !secureEquals(expectedToken, providedToken)) {
      return fail(c, '管理端鉴权失败，请检查 Admin Token', 401)
    }
    return next()
  })

  app.get('/api/admin/stats', async (c) => {
    const repo = getRepository()
    const [products, categories, banners] = await Promise.all([
      repo.listProducts(),
      repo.listCategories(),
      repo.listBanners(),
    ])
    const stats: DashboardStats = {
      productCount: products.length,
      categoryCount: categories.length,
      bannerCount: banners.length,
      featuredCount: products.filter((p) => p.isFeatured).length,
      totalStock: products.reduce((sum, p) => sum + p.stock, 0),
      storageDriver: repo.driver,
    }
    return ok(c, stats)
  })

  app.post('/api/admin/seed', async (c) => {
    const repo = getRepository()
    const result = await repo.seed()
    return ok(c, result)
  })

  app.post('/api/admin/products', async (c) => {
    const repo = getRepository()
    const raw = await c.req.json().catch(() => null)
    const input = parseProductInput(raw)
    const created = await repo.upsertProduct(input)
    return ok(c, created, 201)
  })

  app.put('/api/admin/products/:id', async (c) => {
    const repo = getRepository()
    const id = c.req.param('id')
    const raw = await c.req.json().catch(() => null)
    const input = parseProductInput(raw, id)
    const updated = await repo.upsertProduct(input)
    return ok(c, updated)
  })

  app.delete('/api/admin/products/:id', async (c) => {
    const repo = getRepository()
    const id = c.req.param('id')
    const deleted = await repo.deleteProduct(id)
    if (!deleted) {
      return fail(c, '未找到该商品', 404)
    }
    return ok(c, { id, deleted: true })
  })

  app.post('/api/admin/categories', async (c) => {
    const repo = getRepository()
    const raw = await c.req.json().catch(() => null)
    const input = parseCategoryInput(raw)
    const created = await repo.upsertCategory(input)
    return ok(c, created, 201)
  })

  app.put('/api/admin/categories/:id', async (c) => {
    const repo = getRepository()
    const id = c.req.param('id')
    const raw = await c.req.json().catch(() => null)
    const input = parseCategoryInput(raw, id)
    const updated = await repo.upsertCategory(input)
    return ok(c, updated)
  })

  app.delete('/api/admin/categories/:id', async (c) => {
    const repo = getRepository()
    const id = c.req.param('id')
    const deleted = await repo.deleteCategory(id)
    if (!deleted) {
      return fail(c, '未找到该分类', 404)
    }
    return ok(c, { id, deleted: true })
  })

  app.post('/api/admin/banners', async (c) => {
    const repo = getRepository()
    const raw = await c.req.json().catch(() => null)
    const input = parseBannerInput(raw)
    const created = await repo.upsertBanner(input)
    return ok(c, created, 201)
  })

  app.put('/api/admin/banners/:id', async (c) => {
    const repo = getRepository()
    const id = c.req.param('id')
    const raw = await c.req.json().catch(() => null)
    const input = parseBannerInput(raw, id)
    const updated = await repo.upsertBanner(input)
    return ok(c, updated)
  })

  app.delete('/api/admin/banners/:id', async (c) => {
    const repo = getRepository()
    const id = c.req.param('id')
    const deleted = await repo.deleteBanner(id)
    if (!deleted) {
      return fail(c, '未找到该企划Banner', 404)
    }
    return ok(c, { id, deleted: true })
  })

  app.notFound((c) => fail(c, `路由不存在: ${c.req.method} ${c.req.path}`, 404))

  app.onError((err, c) => {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    const isValidation = message.startsWith('字段 ') || message.startsWith('请求体')
    return fail(c, message, isValidation ? 400 : 500)
  })

  return app
}

export const app = createApp()
