<template>
  <view class="product-card" :class="{ 'is-compact': compact }" @tap="handleTap">
    <view class="cover-box" :style="{ backgroundColor: product.tone }">
      <image
        v-if="product.coverUrl"
        class="cover-image"
        :src="product.coverUrl"
        mode="aspectFill"
      />
      <view v-else class="cover-placeholder">
        <view class="cover-frame" />
        <text class="cover-spec">{{ product.spec }}</text>
      </view>
      <text v-if="product.tag" class="product-tag">{{ product.tag }}</text>
    </view>

    <view class="info-box">
      <text class="product-title">{{ product.title }}</text>
      <text v-if="!compact" class="product-subtitle">{{ product.subtitle }}</text>
      <view class="price-row">
        <text class="price-current">¥{{ product.price }}</text>
        <text v-if="product.originalPrice" class="price-origin">
          ¥{{ product.originalPrice }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { Product } from '@/types/mall'

const props = defineProps<{
  product: Product
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', product: Product): void
}>()

function handleTap() {
  emit('select', props.product)
}
</script>

<style lang="scss" scoped>
.product-card {
  display: flex;
  flex-direction: column;
  background-color: $color-bg-card;
  border-radius: $radius-md;
  overflow: hidden;
  border: 1rpx solid $color-border;
}

.cover-box {
  position: relative;
  width: 100%;
  height: 300rpx;
  overflow: hidden;
}

.is-compact .cover-box {
  height: 220rpx;
}

.cover-image {
  width: 100%;
  height: 100%;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24rpx;
}

.cover-frame {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(31, 30, 28, 0.16);
  background-color: rgba(255, 255, 255, 0.36);
  margin-bottom: 16rpx;
}

.is-compact .cover-frame {
  width: 52rpx;
  height: 52rpx;
  margin-bottom: 10rpx;
}

.cover-spec {
  font-size: 22rpx;
  color: $color-text-secondary;
  text-align: center;
}

.product-tag {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  background-color: rgba(255, 255, 255, 0.88);
  color: $color-text-primary;
  font-size: 20rpx;
  font-weight: 500;
}

.info-box {
  padding: 20rpx;
}

.is-compact .info-box {
  padding: 16rpx;
}

.product-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $color-text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-compact .product-title {
  font-size: 26rpx;
}

.product-subtitle {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $color-text-muted;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  margin-top: 14rpx;
}

.price-current {
  font-size: 30rpx;
  font-weight: 600;
  color: $color-accent;
}

.price-origin {
  font-size: 22rpx;
  color: $color-text-muted;
  text-decoration: line-through;
}
</style>
