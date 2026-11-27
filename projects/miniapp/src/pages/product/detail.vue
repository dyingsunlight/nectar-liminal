<template>
  <view class="detail-page">
    <view v-if="loading" class="state-box">
      <text class="state-text">正在加载商品信息…</text>
    </view>

    <view v-else-if="loadError" class="state-box">
      <text class="state-text">{{ loadError }}</text>
      <button class="back-btn" @tap="retryFetch">重新加载</button>
    </view>

    <view v-else-if="!product" class="state-box">
      <text class="state-text">未找到该商品</text>
      <button class="back-btn" @tap="goBack">返回上一页</button>
    </view>

    <template v-else>
      <!-- 商品视觉展示区 -->
      <view class="hero-box" :style="{ backgroundColor: product.tone }">
        <image
          v-if="product.coverUrl"
          class="hero-image"
          :src="product.coverUrl"
          mode="aspectFill"
        />
        <view v-else class="hero-placeholder">
          <view class="hero-ring" />
          <text class="hero-spec">{{ product.spec }}</text>
        </view>
        <text v-if="product.tag" class="hero-tag">{{ product.tag }}</text>
      </view>

      <!-- 核心信息卡片 -->
      <view class="info-card">
        <view class="price-row">
          <text class="price-current">¥{{ product.price }}</text>
          <text v-if="product.originalPrice" class="price-origin">
            ¥{{ product.originalPrice }}
          </text>
          <text class="stock-tip">库存 {{ product.stock }} {{ product.unit }}</text>
        </view>

        <text class="detail-title">{{ product.title }}</text>
        <text class="detail-subtitle">{{ product.subtitle }}</text>

        <view class="spec-row">
          <text class="spec-label">默认规格</text>
          <text class="spec-pill">{{ product.spec }}</text>
        </view>

        <text class="detail-desc">{{ product.description }}</text>
      </view>

      <!-- 底部操作栏 -->
      <view class="action-bar">
        <view class="cart-entry" @tap="goCart">
          <text class="cart-entry-label">购物袋</text>
          <text v-if="cartStore.totalCount > 0" class="cart-badge">
            {{ cartStore.totalCount }}
          </text>
        </view>

        <button
          class="add-cart-btn"
          :class="{ 'is-disabled': product.stock <= 0 }"
          :disabled="product.stock <= 0"
          @tap="handleAddToCart"
        >
          {{ product.stock <= 0 ? '暂时缺货' : '加入购物袋' }}
        </button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getProductDetail } from '@/services'
import { useCartStore } from '@/stores/cart'
import type { Product } from '@/types/mall'

const cartStore = useCartStore()
const loading = ref(true)
const loadError = ref('')
const currentId = ref('')
const product = ref<Product | null>(null)

async function fetchDetail(id: string) {
  loading.value = true
  loadError.value = ''
  try {
    const res = await getProductDetail(id)
    if (res.code === 0 && res.data) {
      product.value = res.data
    } else if (res.code === 404) {
      product.value = null
    } else {
      loadError.value = res.message || '商品详情加载失败'
    }
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '网络请求失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

onLoad((options) => {
  cartStore.hydrate()
  const id = typeof options?.id === 'string' ? options.id : ''
  currentId.value = id
  if (!id) {
    loading.value = false
    product.value = null
    return
  }
  void fetchDetail(id)
})

function retryFetch() {
  if (!currentId.value) return
  void fetchDetail(currentId.value)
}

function handleAddToCart() {
  if (!product.value) return
  if (product.value.stock <= 0) {
    uni.showToast({
      title: '该商品暂时缺货',
      icon: 'none',
    })
    return
  }
  cartStore.addItem(product.value)
  uni.showToast({
    title: '已加入购物袋',
    icon: 'success',
  })
}

function goCart() {
  uni.switchTab({
    url: '/pages/cart/index',
  })
}

function goBack() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  padding-bottom: 148rpx;
}

.state-box {
  padding: 160rpx 40rpx;
  text-align: center;
}

.state-text {
  display: block;
  font-size: 28rpx;
  color: $color-text-muted;
}

.back-btn {
  display: inline-block;
  margin-top: 32rpx;
  padding: 16rpx 40rpx;
  border-radius: 999rpx;
  background-color: $color-text-primary;
  color: #FFFFFF;
  font-size: 25rpx;
}

.hero-box {
  position: relative;
  width: 100%;
  height: 540rpx;
  overflow: hidden;
}

.hero-image {
  width: 100%;
  height: 100%;
}

.hero-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.hero-ring {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(31, 30, 28, 0.16);
  background-color: rgba(255, 255, 255, 0.35);
  margin-bottom: 24rpx;
}

.hero-spec {
  font-size: 26rpx;
  color: $color-text-secondary;
}

.hero-tag {
  position: absolute;
  left: 28rpx;
  bottom: 28rpx;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  background-color: rgba(255, 255, 255, 0.9);
  font-size: 22rpx;
  color: $color-text-primary;
  font-weight: 500;
}

.info-card {
  margin: 24rpx 28rpx 0;
  padding: 32rpx;
  border-radius: $radius-lg;
  background-color: $color-bg-card;
  border: 1rpx solid $color-border;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 14rpx;
}

.price-current {
  font-size: 44rpx;
  font-weight: 600;
  color: $color-accent;
}

.price-origin {
  font-size: 26rpx;
  color: $color-text-muted;
  text-decoration: line-through;
}

.stock-tip {
  margin-left: auto;
  font-size: 23rpx;
  color: $color-text-muted;
}

.detail-title {
  display: block;
  margin-top: 18rpx;
  font-size: 36rpx;
  font-weight: 600;
  color: $color-text-primary;
}

.detail-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: $color-text-secondary;
}

.spec-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 26rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid $color-border;
}

.spec-label {
  font-size: 24rpx;
  color: $color-text-muted;
}

.spec-pill {
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  background-color: $color-bg-muted;
  color: $color-text-primary;
  font-size: 23rpx;
}

.detail-desc {
  display: block;
  margin-top: 24rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: $color-text-secondary;
}

.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 18rpx 28rpx calc(18rpx + env(safe-area-inset-bottom));
  background-color: #FFFFFF;
  border-top: 1rpx solid $color-border;
  display: flex;
  align-items: center;
  gap: 24rpx;
  z-index: 20;
}

.cart-entry {
  position: relative;
  padding: 16rpx 28rpx;
  border-radius: 999rpx;
  background-color: $color-bg-muted;
}

.cart-entry-label {
  font-size: 26rpx;
  font-weight: 500;
  color: $color-text-primary;
}

.cart-badge {
  position: absolute;
  top: -6rpx;
  right: -4rpx;
  min-width: 34rpx;
  height: 34rpx;
  padding: 0 8rpx;
  border-radius: 999rpx;
  background-color: $color-accent;
  color: #FFFFFF;
  font-size: 20rpx;
  line-height: 34rpx;
  text-align: center;
}

.add-cart-btn {
  flex: 1;
  height: 82rpx;
  line-height: 82rpx;
  border-radius: 999rpx;
  background-color: $color-text-primary;
  color: #FFFFFF;
  font-size: 28rpx;
  font-weight: 500;
  text-align: center;
}

.add-cart-btn.is-disabled {
  background-color: #C8C2B7;
}
</style>
