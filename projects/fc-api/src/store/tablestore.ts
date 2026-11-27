import { randomUUID } from 'node:crypto'
import TableStore, {
  type AttributeColumn,
  type Client,
  type LongValue,
  type PrimaryKey,
  type TableStoreRow,
} from 'tablestore'
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

export interface FcStsCredentials {
  accessKeyId?: string
  accessKeySecret?: string
  securityToken?: string
}

let runtimeStsCredentials: FcStsCredentials = {}

export function updateRuntimeStsCredentials(creds?: FcStsCredentials): void {
  if (creds?.accessKeyId && creds?.accessKeySecret) {
    runtimeStsCredentials = {
      accessKeyId: creds.accessKeyId,
      accessKeySecret: creds.accessKeySecret,
      securityToken: creds.securityToken,
    }
  }
}

function getTableNames() {
  return {
    categories: process.env.OTS_TABLE_CATEGORIES || 'categories',
    products: process.env.OTS_TABLE_PRODUCTS || 'products',
    banners: process.env.OTS_TABLE_BANNERS || 'banners',
    users: process.env.OTS_TABLE_USERS || 'users',
  }
}

function createTableStoreClient(): Client {
  const endpoint = process.env.OTS_ENDPOINT
  const instancename = process.env.OTS_INSTANCE_NAME
  if (!endpoint || !instancename) {
    throw new Error('OTS_ENDPOINT and OTS_INSTANCE_NAME must be configured')
  }

  const accessKeyId =
    runtimeStsCredentials.accessKeyId ||
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID ||
    process.env.OTS_ACCESS_KEY_ID ||
    ''
  const secretAccessKey =
    runtimeStsCredentials.accessKeySecret ||
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET ||
    process.env.OTS_ACCESS_KEY_SECRET ||
    ''
  const securityToken =
    runtimeStsCredentials.securityToken ||
    process.env.ALIBABA_CLOUD_SECURITY_TOKEN ||
    process.env.OTS_SECURITY_TOKEN

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing Alibaba Cloud credentials (FC Execution Role STS or ALIBABA_CLOUD_ACCESS_KEY_ID / SECRET)'
    )
  }

  return new TableStore.Client({
    accessKeyId,
    secretAccessKey,
    endpoint,
    instancename,
    ...(securityToken
      ? { stsToken: securityToken, securityToken }
      : {}),
  })
}

function isLongValue(value: unknown): value is LongValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toNumber' in value &&
    typeof (value as LongValue).toNumber === 'function'
  )
}

function normalizeCellValue(value: unknown): unknown {
  if (isLongValue(value)) {
    return value.toNumber()
  }
  return value
}

function rowToRecord<T>(row?: TableStoreRow): T | null {
  if (!row || (!row.primaryKey?.length && !row.attributes?.length)) {
    return null
  }
  const attrMap = new Map<string, unknown>()
  for (const pk of row.primaryKey ?? []) {
    attrMap.set(pk.name, normalizeCellValue(pk.value))
  }
  for (const attr of row.attributes ?? []) {
    attrMap.set(attr.columnName, normalizeCellValue(attr.columnValue))
  }

  const payloadRaw = attrMap.get('payload')
  if (typeof payloadRaw === 'string' && payloadRaw.length > 0) {
    return JSON.parse(payloadRaw) as T
  }

  const fallback: Record<string, unknown> = {}
  for (const [key, value] of attrMap.entries()) {
    if (key !== 'payload' && key !== 'updatedAt') {
      fallback[key] = value
    }
  }
  return fallback as T
}

function putRowAsync(
  client: Client,
  tableName: string,
  primaryKey: PrimaryKey,
  attributeColumns: AttributeColumn[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    client.putRow(
      {
        tableName,
        condition: new TableStore.Condition(TableStore.RowExistenceExpectation.IGNORE, null),
        primaryKey,
        attributeColumns,
      },
      (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      }
    )
  })
}

function getRowAsync(
  client: Client,
  tableName: string,
  primaryKey: PrimaryKey
): Promise<TableStoreRow | undefined> {
  return new Promise((resolve, reject) => {
    client.getRow(
      {
        tableName,
        primaryKey,
      },
      (err, data) => {
        if (err) {
          reject(err)
          return
        }
        resolve(data.row)
      }
    )
  })
}

function deleteRowAsync(
  client: Client,
  tableName: string,
  primaryKey: PrimaryKey
): Promise<void> {
  return new Promise((resolve, reject) => {
    client.deleteRow(
      {
        tableName,
        condition: new TableStore.Condition(TableStore.RowExistenceExpectation.IGNORE, null),
        primaryKey,
      },
      (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      }
    )
  })
}

async function scanAllRows<T>(
  client: Client,
  tableName: string,
  pkName: string
): Promise<T[]> {
  const results: T[] = []
  let startPrimaryKey: PrimaryKey = [{ [pkName]: TableStore.INF_MIN }]
  const endPrimaryKey: PrimaryKey = [{ [pkName]: TableStore.INF_MAX }]

  while (true) {
    const page = await new Promise<{
      rows: TableStoreRow[]
      nextStartPrimaryKey: PrimaryKey | null | undefined
    }>((resolve, reject) => {
      client.getRange(
        {
          tableName,
          direction: TableStore.Direction.FORWARD,
          inclusiveStartPrimaryKey: startPrimaryKey,
          exclusiveEndPrimaryKey: endPrimaryKey,
          limit: 200,
        },
        (err, data) => {
          if (err) {
            reject(err)
            return
          }
          resolve({
            rows: data.rows ?? [],
            nextStartPrimaryKey: data.next_start_primary_key,
          })
        }
      )
    })

    for (const row of page.rows) {
      const record = rowToRecord<T>(row)
      if (record) {
        results.push(record)
      }
    }

    if (!page.nextStartPrimaryKey || page.nextStartPrimaryKey.length === 0) {
      break
    }
    startPrimaryKey = page.nextStartPrimaryKey
  }

  return results
}

async function saveUserRow(
  client: Client,
  tableName: string,
  openId: string,
  profile: UserProfile
): Promise<void> {
  await putRowAsync(
    client,
    tableName,
    [{ openId }],
    [
      { nickname: profile.nickname },
      { payload: JSON.stringify(profile) },
      { updatedAt: TableStore.Long.fromNumber(Date.now()) },
    ]
  )
}

export class TableStoreRepository implements Repository {
  readonly driver = 'tablestore' as const

  async listCategories(): Promise<Category[]> {
    const client = createTableStoreClient()
    const tables = getTableNames()
    return scanAllRows<Category>(client, tables.categories, 'id')
  }

  async upsertCategory(input: UpsertCategoryInput): Promise<Category> {
    const client = createTableStoreClient()
    const tables = getTableNames()
    const id = input.id?.trim() || `cat-${randomUUID().slice(0, 8)}`
    const record: Category = {
      id,
      name: input.name.trim(),
      enName: input.enName.trim(),
      description: input.description.trim(),
    }

    await putRowAsync(
      client,
      tables.categories,
      [{ id }],
      [
        { name: record.name },
        { enName: record.enName },
        { description: record.description },
        { payload: JSON.stringify(record) },
        { updatedAt: TableStore.Long.fromNumber(Date.now()) },
      ]
    )

    return record
  }

  async deleteCategory(id: string): Promise<boolean> {
    const client = createTableStoreClient()
    const tables = getTableNames()
    const existing = await getRowAsync(client, tables.categories, [{ id }])
    if (!rowToRecord<Category>(existing)) {
      return false
    }
    await deleteRowAsync(client, tables.categories, [{ id }])
    return true
  }

  async listProducts(params?: ProductQueryParams): Promise<Product[]> {
    const client = createTableStoreClient()
    const tables = getTableNames()
    let items = await scanAllRows<Product>(client, tables.products, 'id')

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
    return items
  }

  async getProduct(id: string): Promise<Product | null> {
    const client = createTableStoreClient()
    const tables = getTableNames()
    const row = await getRowAsync(client, tables.products, [{ id }])
    return rowToRecord<Product>(row)
  }

  async upsertProduct(input: UpsertProductInput): Promise<Product> {
    const client = createTableStoreClient()
    const tables = getTableNames()
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

    await putRowAsync(
      client,
      tables.products,
      [{ id }],
      [
        { categoryId: record.categoryId },
        { title: record.title },
        { price: record.price },
        { stock: TableStore.Long.fromNumber(record.stock) },
        { isFeatured: Boolean(record.isFeatured) },
        { payload: JSON.stringify(record) },
        { updatedAt: TableStore.Long.fromNumber(Date.now()) },
      ]
    )

    return record
  }

  async deleteProduct(id: string): Promise<boolean> {
    const client = createTableStoreClient()
    const tables = getTableNames()
    const existing = await getRowAsync(client, tables.products, [{ id }])
    if (!rowToRecord<Product>(existing)) {
      return false
    }
    await deleteRowAsync(client, tables.products, [{ id }])
    return true
  }

  async listBanners(): Promise<BannerItem[]> {
    const client = createTableStoreClient()
    const tables = getTableNames()
    return scanAllRows<BannerItem>(client, tables.banners, 'id')
  }

  async upsertBanner(input: UpsertBannerInput): Promise<BannerItem> {
    const client = createTableStoreClient()
    const tables = getTableNames()
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

    await putRowAsync(
      client,
      tables.banners,
      [{ id }],
      [
        { title: record.title },
        { tag: record.tag },
        { payload: JSON.stringify(record) },
        { updatedAt: TableStore.Long.fromNumber(Date.now()) },
      ]
    )

    return record
  }

  async deleteBanner(id: string): Promise<boolean> {
    const client = createTableStoreClient()
    const tables = getTableNames()
    const existing = await getRowAsync(client, tables.banners, [{ id }])
    if (!rowToRecord<BannerItem>(existing)) {
      return false
    }
    await deleteRowAsync(client, tables.banners, [{ id }])
    return true
  }

  async getUser(openId: string): Promise<UserProfile | null> {
    const key = openId.trim()
    if (!key) return null
    const client = createTableStoreClient()
    const tables = getTableNames()
    const existingRow = await getRowAsync(client, tables.users, [{ openId: key }])
    const existing = rowToRecord<Partial<UserProfile>>(existingRow)
    if (!existing) {
      return null
    }
    return normalizeUserProfile(key, existing, new Date().toISOString())
  }

  async loginUser(openId: string): Promise<AuthLoginResult> {
    const key = openId.trim()
    if (!key) {
      throw new Error('openId 不能为空')
    }
    const client = createTableStoreClient()
    const tables = getTableNames()
    const nowIso = new Date().toISOString()
    const existingRow = await getRowAsync(client, tables.users, [{ openId: key }])
    const existing = rowToRecord<Partial<UserProfile>>(existingRow)
    if (existing) {
      const updated: UserProfile = {
        ...normalizeUserProfile(key, existing, nowIso),
        lastLoginAt: nowIso,
      }
      await saveUserRow(client, tables.users, key, updated)
      return {
        profile: updated,
        isNewUser: false,
      }
    }

    const created = createDefaultUser(key, nowIso)
    await saveUserRow(client, tables.users, key, created)
    return {
      profile: created,
      isNewUser: true,
    }
  }

  async updateUser(
    openId: string,
    input: UpdateUserProfileInput
  ): Promise<UserProfile | null> {
    const key = openId.trim()
    if (!key) return null
    const client = createTableStoreClient()
    const tables = getTableNames()
    const existingRow = await getRowAsync(client, tables.users, [{ openId: key }])
    const existing = rowToRecord<Partial<UserProfile>>(existingRow)
    if (!existing) {
      return null
    }

    const nowIso = new Date().toISOString()
    const updated = applyUserProfileUpdate(key, existing, input, nowIso)
    await saveUserRow(client, tables.users, key, updated)
    return updated
  }

  async seed(): Promise<SeedResult> {
    for (const category of SEED_CATEGORIES) {
      await this.upsertCategory(category)
    }
    for (const product of SEED_PRODUCTS) {
      await this.upsertProduct(product)
    }
    for (const banner of SEED_BANNERS) {
      await this.upsertBanner(banner)
    }
    return {
      categories: SEED_CATEGORIES.length,
      products: SEED_PRODUCTS.length,
      banners: SEED_BANNERS.length,
    }
  }
}
