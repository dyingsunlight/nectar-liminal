<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type {
  BannerItem,
  Category,
  DashboardStats,
  Product,
  UpsertBannerInput,
  UpsertCategoryInput,
  UpsertProductInput,
} from '@nectar/shared'
import {
  AdminApiClient,
  getDefaultAdminToken,
  getDefaultApiBaseUrl,
  saveAdminToken,
  saveApiBaseUrlOverride,
} from './api/client'

type ActiveTab = 'products' | 'categories' | 'banners'

const apiBaseUrl = ref(getDefaultApiBaseUrl())
const adminToken = ref(getDefaultAdminToken())
const activeTab = ref<ActiveTab>('products')

const loading = ref(false)
const connected = ref<boolean | null>(null)
const storageDriver = ref<'tablestore' | 'memory' | 'unknown'>('unknown')
const errorMsg = ref('')
const toastMsg = ref('')

const stats = ref<DashboardStats | null>(null)
const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const banners = ref<BannerItem[]>([])

const filterCategory = ref('all')
const filterKeyword = ref('')

const client = computed(() => new AdminApiClient(apiBaseUrl.value, adminToken.value))

const categoryMap = computed(() => {
  const map = new Map<string, string>()
  for (const cat of categories.value) {
    map.set(cat.id, cat.name)
  }
  return map
})

const showProductModal = ref(false)
const productForm = reactive<UpsertProductInput>({
  id: undefined,
  categoryId: 'cat-living',
  title: '',
  subtitle: '',
  price: 99,
  originalPrice: undefined,
  unit: '件',
  tag: '',
  tone: '#E6DDD3',
  spec: '',
  stock: 20,
  isFeatured: false,
  coverUrl: '',
  description: '',
})

const showCategoryModal = ref(false)
const categoryForm = reactive<UpsertCategoryInput>({
  id: undefined,
  name: '',
  enName: '',
  description: '',
})

const showBannerModal = ref(false)
const bannerForm = reactive<UpsertBannerInput>({
  id: undefined,
  title: '',
  subtitle: '',
  tag: '',
  tone: '#E4DAD0',
  coverUrl: '',
  targetProductId: '',
})

function setToast(message: string) {
  toastMsg.value = message
  errorMsg.value = ''
}

function setError(err: unknown) {
  errorMsg.value = err instanceof Error ? err.message : '操作失败'
  toastMsg.value = ''
}

async function refreshAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    saveApiBaseUrlOverride(apiBaseUrl.value)
    saveAdminToken(adminToken.value)

    const health = await client.value.health()
    connected.value = health.status === 'ok'
    storageDriver.value = health.storageDriver

    const [nextStats, nextCategories, nextProducts, nextBanners] = await Promise.all([
      client.value.stats(),
      client.value.listCategories(),
      client.value.listProducts(filterCategory.value, filterKeyword.value),
      client.value.listBanners(),
    ])
    stats.value = nextStats
    categories.value = nextCategories
    products.value = nextProducts
    banners.value = nextBanners
  } catch (err) {
    connected.value = false
    setError(err)
  } finally {
    loading.value = false
  }
}

async function reloadProductsOnly() {
  loading.value = true
  try {
    products.value = await client.value.listProducts(filterCategory.value, filterKeyword.value)
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
}

async function handleSeed() {
  loading.value = true
  try {
    const res = await client.value.seed()
    await refreshAll()
    setToast(
      `已写入初始数据：${res.categories} 个分类、${res.products} 件商品、${res.banners} 条企划 Banner`
    )
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
}

function openProductModal(item?: Product) {
  if (item) {
    Object.assign(productForm, {
      id: item.id,
      categoryId: item.categoryId,
      title: item.title,
      subtitle: item.subtitle,
      price: item.price,
      originalPrice: item.originalPrice,
      unit: item.unit,
      tag: item.tag || '',
      tone: item.tone,
      spec: item.spec,
      stock: item.stock,
      isFeatured: Boolean(item.isFeatured),
      coverUrl: item.coverUrl || '',
      description: item.description,
    })
  } else {
    Object.assign(productForm, {
      id: undefined,
      categoryId: categories.value[0]?.id || 'cat-living',
      title: '',
      subtitle: '',
      price: 128,
      originalPrice: undefined,
      unit: '件',
      tag: '',
      tone: '#E6DDD3',
      spec: '',
      stock: 20,
      isFeatured: false,
      coverUrl: '',
      description: '',
    })
  }
  showProductModal.value = true
}

async function submitProduct() {
  loading.value = true
  try {
    await client.value.saveProduct({ ...productForm })
    showProductModal.value = false
    await refreshAll()
    setToast(productForm.id ? '商品已更新' : '商品已创建')
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
}

async function removeProduct(id: string) {
  loading.value = true
  try {
    await client.value.deleteProduct(id)
    await refreshAll()
    setToast('商品已删除')
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
}

function openCategoryModal(item?: Category) {
  if (item) {
    Object.assign(categoryForm, {
      id: item.id,
      name: item.name,
      enName: item.enName,
      description: item.description,
    })
  } else {
    Object.assign(categoryForm, {
      id: undefined,
      name: '',
      enName: '',
      description: '',
    })
  }
  showCategoryModal.value = true
}

async function submitCategory() {
  loading.value = true
  try {
    await client.value.saveCategory({ ...categoryForm })
    showCategoryModal.value = false
    await refreshAll()
    setToast(categoryForm.id ? '分类已更新' : '分类已创建')
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
}

async function removeCategory(id: string) {
  loading.value = true
  try {
    await client.value.deleteCategory(id)
    await refreshAll()
    setToast('分类已删除')
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
}

function openBannerModal(item?: BannerItem) {
  if (item) {
    Object.assign(bannerForm, {
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      tag: item.tag,
      tone: item.tone,
      coverUrl: item.coverUrl || '',
      targetProductId: item.targetProductId || '',
    })
  } else {
    Object.assign(bannerForm, {
      id: undefined,
      title: '',
      subtitle: '',
      tag: 'SEASONAL EDIT',
      tone: '#E4DAD0',
      coverUrl: '',
      targetProductId: '',
    })
  }
  showBannerModal.value = true
}

async function submitBanner() {
  loading.value = true
  try {
    await client.value.saveBanner({ ...bannerForm })
    showBannerModal.value = false
    await refreshAll()
    setToast(bannerForm.id ? 'Banner 已更新' : 'Banner 已创建')
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
}

async function removeBanner(id: string) {
  loading.value = true
  try {
    await client.value.deleteBanner(id)
    await refreshAll()
    setToast('Banner 已删除')
  } catch (err) {
    setError(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void refreshAll()
})
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <h1>素物集 · Nectar Liminal 管理控制台</h1>
        <p>Cloudflare Pages 前端直连阿里云 FC 3.0 HTTP 端点（原生 CORS + TableStore）</p>
      </div>
      <div class="status-badge">
        <span
          class="dot"
          :class="{ ok: connected === true, err: connected === false }"
        />
        <span v-if="connected === true">已连接 · {{ storageDriver }}</span>
        <span v-else-if="connected === false">连接失败</span>
        <span v-else>检查中...</span>
      </div>
    </header>

    <section class="card">
      <div class="connection-grid">
        <div class="field">
          <label>阿里云 FC HTTP 端点 (CORS 直连)</label>
          <input
            v-model="apiBaseUrl"
            class="input"
            placeholder="https://xxx.cn-hangzhou.fcapp.run"
          />
        </div>
        <div class="field">
          <label>管理令牌 (X-Admin-Token)</label>
          <input
            v-model="adminToken"
            type="password"
            class="input"
            placeholder="输入 Admin Token"
          />
        </div>
        <div class="actions-row">
          <button class="btn" :disabled="loading" @click="refreshAll">
            连接并刷新
          </button>
          <button class="btn btn-primary" :disabled="loading" @click="handleSeed">
            初始化种子数据
          </button>
        </div>
      </div>
    </section>

    <div v-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>
    <div v-if="toastMsg" class="alert alert-ok">{{ toastMsg }}</div>

    <section v-if="stats" class="stats-grid">
      <div class="stat-box">
        <div class="stat-label">商品总数</div>
        <div class="stat-value">{{ stats.productCount }}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">首页精选</div>
        <div class="stat-value">{{ stats.featuredCount }}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">商品分类</div>
        <div class="stat-value">{{ stats.categoryCount }}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">企划 Banner</div>
        <div class="stat-value">{{ stats.bannerCount }}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">总库存件数</div>
        <div class="stat-value">{{ stats.totalStock }}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">存储后端</div>
        <div class="stat-value" style="font-size: 16px">{{ stats.storageDriver }}</div>
      </div>
    </section>

    <nav class="tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'products' }"
        @click="activeTab = 'products'"
      >
        商品管理 ({{ products.length }})
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'categories' }"
        @click="activeTab = 'categories'"
      >
        分类管理 ({{ categories.length }})
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'banners' }"
        @click="activeTab = 'banners'"
      >
        首页企划 ({{ banners.length }})
      </button>
    </nav>

    <section v-if="activeTab === 'products'" class="card">
      <div class="toolbar">
        <div class="toolbar-filters">
          <select v-model="filterCategory" class="select" @change="reloadProductsOnly">
            <option value="all">全部分类</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
          <input
            v-model="filterKeyword"
            class="input"
            placeholder="搜索商品标题或卖点..."
            @keyup.enter="reloadProductsOnly"
          />
          <button class="btn" :disabled="loading" @click="reloadProductsOnly">
            筛选
          </button>
        </div>
        <button class="btn btn-primary" :disabled="loading" @click="openProductModal()">
          + 新增商品
        </button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>商品</th>
              <th>分类</th>
              <th>规格</th>
              <th>售价</th>
              <th>库存</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in products" :key="item.id">
              <td>
                <span class="swatch" :style="{ backgroundColor: item.tone }" />
                <strong>{{ item.title }}</strong>
                <div style="color: var(--ink-secondary); font-size: 12px">
                  {{ item.subtitle }}
                </div>
              </td>
              <td>{{ categoryMap.get(item.categoryId) || item.categoryId }}</td>
              <td>{{ item.spec }}</td>
              <td>
                ¥{{ item.price }} / {{ item.unit }}
                <span
                  v-if="item.originalPrice"
                  style="color: var(--ink-muted); text-decoration: line-through; margin-left: 4px"
                >
                  ¥{{ item.originalPrice }}
                </span>
              </td>
              <td>{{ item.stock }}</td>
              <td>
                <span v-if="item.isFeatured" class="pill pill-featured">首页精选</span>
                <span v-if="item.tag" class="pill" style="margin-left: 4px">{{ item.tag }}</span>
              </td>
              <td>
                <div class="actions-row">
                  <button class="btn btn-sm" @click="openProductModal(item)">编辑</button>
                  <button class="btn btn-sm btn-danger" @click="removeProduct(item.id)">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="products.length === 0">
              <td colspan="7" style="text-align: center; color: var(--ink-muted)">
                暂无商品数据，可点击右上角“初始化种子数据”或新增商品
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="activeTab === 'categories'" class="card">
      <div class="toolbar">
        <div style="color: var(--ink-secondary); font-size: 13px">
          分类 ID 会同步至小程序分类页筛选与商品归类
        </div>
        <button class="btn btn-primary" :disabled="loading" @click="openCategoryModal()">
          + 新增分类
        </button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>名称</th>
              <th>英文标识</th>
              <th>描述</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cat in categories" :key="cat.id">
              <td><code>{{ cat.id }}</code></td>
              <td><strong>{{ cat.name }}</strong></td>
              <td>{{ cat.enName }}</td>
              <td>{{ cat.description }}</td>
              <td>
                <div class="actions-row">
                  <button class="btn btn-sm" @click="openCategoryModal(cat)">编辑</button>
                  <button class="btn btn-sm btn-danger" @click="removeCategory(cat.id)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="activeTab === 'banners'" class="card">
      <div class="toolbar">
        <div style="color: var(--ink-secondary); font-size: 13px">
          对应小程序首页顶部轮播企划卡片
        </div>
        <button class="btn btn-primary" :disabled="loading" @click="openBannerModal()">
          + 新增企划
        </button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>标签</th>
              <th>标题</th>
              <th>副标题</th>
              <th>跳转商品 ID</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="banner in banners" :key="banner.id">
              <td>
                <span class="swatch" :style="{ backgroundColor: banner.tone }" />
                <span class="pill">{{ banner.tag }}</span>
              </td>
              <td><strong>{{ banner.title }}</strong></td>
              <td>{{ banner.subtitle }}</td>
              <td><code>{{ banner.targetProductId || '-' }}</code></td>
              <td>
                <div class="actions-row">
                  <button class="btn btn-sm" @click="openBannerModal(banner)">编辑</button>
                  <button class="btn btn-sm btn-danger" @click="removeBanner(banner.id)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="showProductModal" class="modal-backdrop" @click.self="showProductModal = false">
      <div class="modal">
        <h3>{{ productForm.id ? '编辑商品' : '新增商品' }}</h3>
        <div class="form-grid">
          <div class="field">
            <label>商品标题</label>
            <input v-model="productForm.title" class="input" />
          </div>
          <div class="field">
            <label>所属分类</label>
            <select v-model="productForm.categoryId" class="select">
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.name }} ({{ cat.id }})
              </option>
            </select>
          </div>
          <div class="field form-full">
            <label>副标题 / 卖点</label>
            <input v-model="productForm.subtitle" class="input" />
          </div>
          <div class="field">
            <label>售价 (元)</label>
            <input v-model.number="productForm.price" type="number" class="input" />
          </div>
          <div class="field">
            <label>原价 (选填)</label>
            <input v-model.number="productForm.originalPrice" type="number" class="input" />
          </div>
          <div class="field">
            <label>计量单位</label>
            <input v-model="productForm.unit" class="input" placeholder="件 / 罐 / 套" />
          </div>
          <div class="field">
            <label>库存</label>
            <input v-model.number="productForm.stock" type="number" class="input" />
          </div>
          <div class="field">
            <label>规格说明</label>
            <input v-model="productForm.spec" class="input" placeholder="米沙色 · 高 18cm" />
          </div>
          <div class="field">
            <label>角标 (选填)</label>
            <input v-model="productForm.tag" class="input" placeholder="新品 / 人气" />
          </div>
          <div class="field">
            <label>卡片底色 (Hex)</label>
            <input v-model="productForm.tone" class="input" placeholder="#E6DDD3" />
          </div>
          <div class="checkbox-row">
            <input id="featuredCheck" v-model="productForm.isFeatured" type="checkbox" />
            <label for="featuredCheck">展示在首页精选</label>
          </div>
          <div class="field form-full">
            <label>商品描述</label>
            <textarea v-model="productForm.description" class="textarea" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showProductModal = false">取消</button>
          <button class="btn btn-primary" :disabled="loading" @click="submitProduct">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showCategoryModal" class="modal-backdrop" @click.self="showCategoryModal = false">
      <div class="modal">
        <h3>{{ categoryForm.id ? '编辑分类' : '新增分类' }}</h3>
        <div class="form-grid">
          <div class="field">
            <label>分类名称</label>
            <input v-model="categoryForm.name" class="input" />
          </div>
          <div class="field">
            <label>英文标识</label>
            <input v-model="categoryForm.enName" class="input" placeholder="LIVING" />
          </div>
          <div class="field form-full">
            <label>分类说明</label>
            <textarea v-model="categoryForm.description" class="textarea" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showCategoryModal = false">取消</button>
          <button class="btn btn-primary" :disabled="loading" @click="submitCategory">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showBannerModal" class="modal-backdrop" @click.self="showBannerModal = false">
      <div class="modal">
        <h3>{{ bannerForm.id ? '编辑企划 Banner' : '新增企划 Banner' }}</h3>
        <div class="form-grid">
          <div class="field form-full">
            <label>企划标题</label>
            <input v-model="bannerForm.title" class="input" />
          </div>
          <div class="field form-full">
            <label>副标题</label>
            <input v-model="bannerForm.subtitle" class="input" />
          </div>
          <div class="field">
            <label>英文标签</label>
            <input v-model="bannerForm.tag" class="input" />
          </div>
          <div class="field">
            <label>卡片底色</label>
            <input v-model="bannerForm.tone" class="input" />
          </div>
          <div class="field form-full">
            <label>关联跳转商品 ID (选填)</label>
            <input v-model="bannerForm.targetProductId" class="input" placeholder="如 prod-1" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showBannerModal = false">取消</button>
          <button class="btn btn-primary" :disabled="loading" @click="submitBanner">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>
