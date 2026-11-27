<template>
  <view class="category-page">
    <!-- 左侧分类栏 -->
    <scroll-view scroll-y class="sidebar">
      <view
        v-for="item in navItems"
        :key="item.id"
        class="sidebar-item"
        :class="{ 'is-active': activeId === item.id }"
        @tap="selectCategory(item.id)"
      >
        <text class="sidebar-name">{{ item.name }}</text>
        <text class="sidebar-en">{{ item.enName }}</text>
      </view>
    </scroll-view>

    <!-- 右侧商品列表 -->
    <scroll-view scroll-y class="content">
      <view class="content-header">
        <text class="content-title">{{ currentCategory?.name || '全部好物' }}</text>
        <text class="content-desc">
          {{ currentCategory?.description || '素物集全部精选生活方式单品' }}
        </text>
      </view>

      <view v-if="loading" class="state-tip">
        <text>加载中…</text>
      </view>

      <view v-else-if="errorMsg" class="state-tip">
        <text class="error-text">{{ errorMsg }}</text>
        <button class="retry-btn" @tap="reloadAll">重试</button>
      </view>

      <view v-else-if="products.length === 0" class="state-tip">
        <text>当前分类暂无商品</text>
      </view>

      <view v-else class="goods-grid">
        <ProductCard
          v-for="item in products"
          :key="item.id"
          :product="item"
          compact
          @select="goDetail"
        />
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, onMounted, ref } from 'vue'
import ProductCard from '@/components/ProductCard.vue'
import { getCategories, getProductList } from '@/services'
import { useAppStore } from '@/stores/app'
import type { Category, Product } from '@/types/mall'

const ALL_CATEGORY: Category = {
  id: 'all',
  name: '全部好物',
  enName: 'ALL',
  description: '素物集全部精选生活方式单品',
}

const appStore = useAppStore()

const categories = ref<Category[]>([])
const products = ref<Product[]>([])
const activeId = ref('all')
const loading = ref(true)
const errorMsg = ref('')
const hasInitialized = ref(false)

const navItems = computed(() => [ALL_CATEGORY, ...categories.value])

const currentCategory = computed(() =>
  navItems.value.find((item) => item.id === activeId.value)
)

async function loadCategories() {
  const res = await getCategories()
  if (res.code === 0 && Array.isArray(res.data)) {
    categories.value = res.data
    return true
  }
  errorMsg.value = res.message || '分类加载失败'
  return false
}

async function loadProducts(categoryId: string) {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await getProductList({ categoryId })
    if (res.code === 0 && Array.isArray(res.data)) {
      products.value = res.data
    } else {
      errorMsg.value = res.message || '商品加载失败'
    }
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '网络请求失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function reloadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    await loadCategories()
    await loadProducts(activeId.value)
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '网络请求失败，请稍后重试'
    loading.value = false
  }
}

function selectCategory(categoryId: string) {
  if (activeId.value === categoryId && !errorMsg.value) return
  activeId.value = categoryId
  void loadProducts(categoryId)
}

function goDetail(product: Product) {
  uni.navigateTo({
    url: `/pages/product/detail?id=${product.id}`,
  })
}

onMounted(async () => {
  const pending = appStore.consumePendingCategory()
  if (pending) {
    activeId.value = pending
  }
  await reloadAll()
  hasInitialized.value = true
})

onShow(() => {
  const pending = appStore.consumePendingCategory()
  if (pending && hasInitialized.value) {
    if (pending !== activeId.value || errorMsg.value) {
      activeId.value = pending
      void loadProducts(pending)
    }
  }
})

onPullDownRefresh(async () => {
  try {
    await reloadAll()
  } finally {
    uni.stopPullDownRefresh()
  }
})
</script>

<style lang="scss" scoped>
.category-page {
  display: flex;
  height: 100vh;
  background-color: $color-bg-page;
}

.sidebar {
  width: 200rpx;
  height: 100%;
  flex-shrink: 0;
  background-color: $color-bg-muted;
  border-right: 1rpx solid $color-border;
}

.sidebar-item {
  position: relative;
  padding: 28rpx 20rpx;
  border-bottom: 1rpx solid rgba(234, 230, 222, 0.7);
}

.sidebar-item.is-active {
  background-color: $color-bg-page;
}

.sidebar-item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 24rpx;
  bottom: 24rpx;
  width: 6rpx;
  border-radius: 0 6rpx 6rpx 0;
  background-color: $color-accent;
}

.sidebar-name {
  display: block;
  font-size: 26rpx;
  font-weight: 500;
  color: $color-text-secondary;
}

.sidebar-item.is-active .sidebar-name {
  color: $color-text-primary;
  font-weight: 600;
}

.sidebar-en {
  display: block;
  margin-top: 4rpx;
  font-size: 18rpx;
  letter-spacing: 1.5rpx;
  color: $color-text-muted;
}

.content {
  flex: 1;
  height: 100%;
  padding: 24rpx;
}

.content-header {
  padding-bottom: 20rpx;
  margin-bottom: 20rpx;
  border-bottom: 1rpx solid $color-border;
}

.content-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: $color-text-primary;
}

.content-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 23rpx;
  color: $color-text-muted;
}

.state-tip {
  padding: 80rpx 16rpx;
  text-align: center;
  font-size: 25rpx;
  color: $color-text-muted;
}

.error-text {
  display: block;
  color: $color-text-secondary;
  margin-bottom: 24rpx;
}

.retry-btn {
  display: inline-block;
  padding: 12rpx 34rpx;
  border-radius: 999rpx;
  background-color: $color-text-primary;
  color: #FFFFFF;
  font-size: 23rpx;
}

.goods-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
  padding-bottom: 40rpx;
}
</style>
