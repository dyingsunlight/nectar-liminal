<template>
  <view class="home-page">
    <!-- 顶部品牌栏 -->
    <view class="brand-header">
      <view>
        <text class="brand-en">SUWU ATELIER</text>
        <text class="brand-name">素物集</text>
      </view>
      <text class="brand-badge">甄选生活</text>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <input
        v-model="searchKeyword"
        class="search-input"
        type="text"
        confirm-type="search"
        placeholder="搜索家居器物、香氛、亚麻织物…"
        placeholder-class="search-placeholder"
        @confirm="handleSearch"
      />
      <text v-if="searchKeyword || isSearchMode" class="search-clear" @tap="clearSearch">
        清空
      </text>
      <text class="search-action" @tap="handleSearch">搜索</text>
    </view>

    <!-- 搜索结果视图 -->
    <template v-if="isSearchMode">
      <view class="section-header">
        <text class="section-title">搜索“{{ activeSearchTerm }}”</text>
        <text class="section-sub" @tap="clearSearch">返回首页</text>
      </view>

      <view v-if="searching" class="state-tip">
        <text>正在搜索好物…</text>
      </view>

      <view v-else-if="searchError" class="state-tip">
        <text class="error-text">{{ searchError }}</text>
        <button class="retry-btn" @tap="handleSearch">重试</button>
      </view>

      <view v-else-if="searchResults.length === 0" class="state-tip">
        <text>未找到相关商品，试试换个关键词</text>
      </view>

      <view v-else class="product-grid">
        <ProductCard
          v-for="item in searchResults"
          :key="item.id"
          :product="item"
          @select="goProductDetail"
        />
      </view>
    </template>

    <!-- 常规首页视图 -->
    <template v-else>
      <view v-if="loading" class="state-tip">
        <text>正在加载好物…</text>
      </view>

      <view v-else-if="loadError" class="state-tip">
        <text class="error-text">{{ loadError }}</text>
        <button class="retry-btn" @tap="loadHome">重新加载</button>
      </view>

      <template v-else>
        <!-- 首屏推荐 Banner -->
        <swiper
          v-if="banners.length > 0"
          class="hero-swiper"
          indicator-dots
          indicator-color="rgba(31, 30, 28, 0.18)"
          indicator-active-color="#B66A49"
          autoplay
          circular
          :interval="4500"
        >
          <swiper-item v-for="banner in banners" :key="banner.id">
            <view
              class="banner-card"
              :class="{ 'has-cover': Boolean(banner.coverUrl) }"
              :style="{ backgroundColor: banner.tone }"
              @tap="handleBannerTap(banner)"
            >
              <image
                v-if="banner.coverUrl"
                class="banner-image"
                :src="banner.coverUrl"
                mode="aspectFill"
              />
              <view v-if="banner.coverUrl" class="banner-overlay" />
              <view class="banner-content">
                <text class="banner-tag">{{ banner.tag }}</text>
                <text class="banner-title">{{ banner.title }}</text>
                <text class="banner-subtitle">{{ banner.subtitle }}</text>
                <text class="banner-action">查看单品 →</text>
              </view>
            </view>
          </swiper-item>
        </swiper>

        <!-- 快捷分类导航 -->
        <view class="section-header">
          <text class="section-title">精选分类</text>
          <text class="section-more" @tap="goCategory('all')">全部 →</text>
        </view>

        <view class="category-pills">
          <view
            v-for="cat in categories"
            :key="cat.id"
            class="category-pill"
            @tap="goCategory(cat.id)"
          >
            <text class="pill-name">{{ cat.name }}</text>
            <text class="pill-en">{{ cat.enName }}</text>
          </view>
        </view>

        <!-- 精选好物列表 -->
        <view class="section-header">
          <text class="section-title">今日精选</text>
          <text class="section-sub">{{ featuredProducts.length }} 件好物</text>
        </view>

        <view v-if="featuredProducts.length === 0" class="state-tip">
          <text>暂无精选商品</text>
        </view>

        <view v-else class="product-grid">
          <ProductCard
            v-for="item in featuredProducts"
            :key="item.id"
            :product="item"
            @select="goProductDetail"
          />
        </view>
      </template>
    </template>
  </view>
</template>

<script setup lang="ts">
import { onPullDownRefresh } from '@dcloudio/uni-app'
import { onMounted, ref } from 'vue'
import ProductCard from '@/components/ProductCard.vue'
import { getHomeData, getProductList } from '@/services'
import { useAppStore } from '@/stores/app'
import type { BannerItem, Category, Product } from '@/types/mall'

const appStore = useAppStore()

const loading = ref(true)
const loadError = ref('')
const banners = ref<BannerItem[]>([])
const categories = ref<Category[]>([])
const featuredProducts = ref<Product[]>([])

const searchKeyword = ref('')
const activeSearchTerm = ref('')
const isSearchMode = ref(false)
const searching = ref(false)
const searchError = ref('')
const searchResults = ref<Product[]>([])

async function loadHome() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await getHomeData()
    if (res.code === 0 && res.data) {
      banners.value = res.data.banners
      categories.value = res.data.categories
      featuredProducts.value = res.data.featuredProducts
    } else {
      loadError.value = res.message || '首页数据加载失败'
    }
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '网络请求失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function runSearch(keyword: string) {
  isSearchMode.value = true
  activeSearchTerm.value = keyword
  searching.value = true
  searchError.value = ''
  try {
    const res = await getProductList({ keyword })
    if (res.code === 0 && Array.isArray(res.data)) {
      searchResults.value = res.data
    } else {
      searchError.value = res.message || '搜索失败，请稍后重试'
    }
  } catch (err) {
    searchError.value = err instanceof Error ? err.message : '网络请求失败，请稍后重试'
  } finally {
    searching.value = false
  }
}

function handleSearch() {
  const kw = searchKeyword.value.trim()
  if (!kw) {
    clearSearch()
    return
  }
  void runSearch(kw)
}

function clearSearch() {
  searchKeyword.value = ''
  activeSearchTerm.value = ''
  isSearchMode.value = false
  searchError.value = ''
  searchResults.value = []
}

function handleBannerTap(banner: BannerItem) {
  if (banner.targetProductId) {
    uni.navigateTo({
      url: `/pages/product/detail?id=${banner.targetProductId}`,
    })
  }
}

function goCategory(categoryId: string) {
  appStore.setPendingCategory(categoryId)
  uni.switchTab({
    url: '/pages/category/index',
  })
}

function goProductDetail(product: Product) {
  uni.navigateTo({
    url: `/pages/product/detail?id=${product.id}`,
  })
}

onMounted(() => {
  void loadHome()
})

onPullDownRefresh(async () => {
  try {
    if (isSearchMode.value && activeSearchTerm.value) {
      await runSearch(activeSearchTerm.value)
    } else {
      await loadHome()
    }
  } finally {
    uni.stopPullDownRefresh()
  }
})
</script>

<style lang="scss" scoped>
.home-page {
  padding: 24rpx 28rpx 48rpx;
}

.brand-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.brand-en {
  display: block;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  color: $color-text-muted;
}

.brand-name {
  display: block;
  font-size: 40rpx;
  font-weight: 600;
  color: $color-text-primary;
  letter-spacing: 2rpx;
}

.brand-badge {
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  background-color: $color-bg-muted;
  color: $color-text-secondary;
  font-size: 22rpx;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  height: 76rpx;
  padding: 0 24rpx;
  margin-bottom: 28rpx;
  border-radius: 999rpx;
  background-color: $color-bg-card;
  border: 1rpx solid $color-border;
}

.search-input {
  flex: 1;
  font-size: 25rpx;
  color: $color-text-primary;
}

.search-placeholder {
  font-size: 25rpx;
  color: $color-text-muted;
}

.search-clear {
  font-size: 23rpx;
  color: $color-text-muted;
  flex-shrink: 0;
}

.search-action {
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  background-color: $color-bg-muted;
  color: $color-text-primary;
  font-size: 23rpx;
  font-weight: 500;
  flex-shrink: 0;
}

.hero-swiper {
  height: 300rpx;
  margin-bottom: 36rpx;
}

.banner-card {
  position: relative;
  height: 100%;
  border-radius: $radius-lg;
  overflow: hidden;
}

.banner-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.banner-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(31, 30, 28, 0.16) 0%,
    rgba(31, 30, 28, 0.62) 100%
  );
}

.banner-content {
  position: relative;
  z-index: 1;
  height: 100%;
  padding: 36rpx 32rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.banner-tag {
  font-size: 20rpx;
  letter-spacing: 2rpx;
  color: $color-text-secondary;
}

.banner-title {
  font-size: 34rpx;
  font-weight: 600;
  color: $color-text-primary;
}

.banner-subtitle {
  font-size: 24rpx;
  color: $color-text-secondary;
}

.banner-card.has-cover .banner-tag,
.banner-card.has-cover .banner-subtitle {
  color: rgba(255, 255, 255, 0.88);
}

.banner-card.has-cover .banner-title {
  color: #FFFFFF;
}

.banner-action {
  align-self: flex-start;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  background-color: rgba(255, 255, 255, 0.85);
  color: $color-text-primary;
  font-size: 22rpx;
  font-weight: 500;
}

.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $color-text-primary;
}

.section-more {
  font-size: 24rpx;
  color: $color-accent;
}

.section-sub {
  font-size: 24rpx;
  color: $color-text-muted;
}

.category-pills {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
  margin-bottom: 40rpx;
}

.category-pill {
  padding: 22rpx 24rpx;
  border-radius: $radius-md;
  background-color: $color-bg-card;
  border: 1rpx solid $color-border;
}

.pill-name {
  display: block;
  font-size: 28rpx;
  font-weight: 500;
  color: $color-text-primary;
}

.pill-en {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  letter-spacing: 2rpx;
  color: $color-text-muted;
}

.state-tip {
  padding: 80rpx 24rpx;
  text-align: center;
  color: $color-text-muted;
  font-size: 26rpx;
}

.error-text {
  display: block;
  color: $color-text-secondary;
  margin-bottom: 24rpx;
}

.retry-btn {
  display: inline-block;
  padding: 14rpx 36rpx;
  border-radius: 999rpx;
  background-color: $color-text-primary;
  color: #FFFFFF;
  font-size: 24rpx;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}
</style>
