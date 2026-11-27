<template>
  <view class="cart-page">
    <!-- 空态 -->
    <view v-if="cartStore.items.length === 0" class="empty-state">
      <view class="empty-circle" />
      <text class="empty-title">购物袋还是空的</text>
      <text class="empty-desc">先去首页或分类挑选几件心仪的居家好物吧</text>
      <button class="primary-btn" @tap="goHome">去首页逛逛</button>
    </view>

    <!-- 商品列表 -->
    <view v-else class="cart-list">
      <view
        v-for="item in cartStore.items"
        :key="item.productId"
        class="cart-card"
      >
        <view class="check-hit" @tap="cartStore.toggleItem(item.productId)">
          <view class="check-circle" :class="{ 'is-checked': item.checked }">
            <text v-if="item.checked" class="check-mark">✓</text>
          </view>
        </view>

        <view
          class="item-thumb"
          :style="{ backgroundColor: item.tone }"
          @tap="goDetail(item.productId)"
        >
          <image
            v-if="item.coverUrl"
            class="thumb-image"
            :src="item.coverUrl"
            mode="aspectFill"
          />
          <view v-else class="thumb-dot" />
        </view>

        <view class="item-body">
          <view class="item-top">
            <text class="item-title" @tap="goDetail(item.productId)">
              {{ item.title }}
            </text>
            <text class="item-remove" @tap="cartStore.removeItem(item.productId)">
              移除
            </text>
          </view>

          <text class="item-spec">{{ item.spec }}</text>

          <view class="item-bottom">
            <text class="item-price">¥{{ item.price }}</text>

            <view class="stepper">
              <view
                class="step-btn"
                @tap="cartStore.updateQuantity(item.productId, -1)"
              >
                <text>-</text>
              </view>
              <text class="step-num">{{ item.quantity }}</text>
              <view
                class="step-btn"
                @tap="cartStore.updateQuantity(item.productId, 1)"
              >
                <text>+</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部结算栏 -->
    <view v-if="cartStore.items.length > 0" class="checkout-bar">
      <view
        class="select-all"
        @tap="cartStore.toggleAll(!cartStore.isAllChecked)"
      >
        <view
          class="check-circle"
          :class="{ 'is-checked': cartStore.isAllChecked }"
        >
          <text v-if="cartStore.isAllChecked" class="check-mark">✓</text>
        </view>
        <text class="select-all-text">全选</text>
      </view>

      <view class="checkout-right">
        <view class="total-box">
          <text class="total-label">合计</text>
          <text class="total-price">¥{{ cartStore.checkedTotalPrice }}</text>
        </view>
        <button
          class="checkout-btn"
          :class="{ 'is-disabled': cartStore.checkedCount === 0 }"
          @tap="handleCheckout"
        >
          去结算 ({{ cartStore.checkedCount }})
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { useCartStore } from '@/stores/cart'

const cartStore = useCartStore()

onShow(() => {
  cartStore.hydrate()
})

function goHome() {
  uni.switchTab({
    url: '/pages/home/index',
  })
}

function goDetail(productId: string) {
  uni.navigateTo({
    url: `/pages/product/detail?id=${productId}`,
  })
}

function handleCheckout() {
  if (cartStore.checkedCount === 0) {
    uni.showToast({
      title: '请先选择要结算的商品',
      icon: 'none',
    })
    return
  }

  uni.showModal({
    title: '演示下单确认',
    content: `共选中 ${cartStore.checkedCount} 件商品，合计 ¥${cartStore.checkedTotalPrice}。确认提交演示订单吗？（当前暂未接入真实支付与订单系统）`,
    confirmText: '确认下单',
    confirmColor: '#B66A49',
    success: (res) => {
      if (res.confirm) {
        cartStore.clearChecked()
        uni.showToast({
          title: '演示下单成功',
          icon: 'success',
        })
      }
    },
  })
}
</script>

<style lang="scss" scoped>
.cart-page {
  min-height: 100vh;
  padding: 24rpx 28rpx 160rpx;
}

.empty-state {
  margin-top: 140rpx;
  padding: 64rpx 40rpx;
  border-radius: $radius-lg;
  background-color: $color-bg-card;
  border: 1rpx solid $color-border;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.empty-circle {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background-color: $color-bg-muted;
  border: 2rpx solid $color-border;
  margin-bottom: 28rpx;
}

.empty-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $color-text-primary;
}

.empty-desc {
  margin-top: 10rpx;
  margin-bottom: 36rpx;
  font-size: 24rpx;
  color: $color-text-muted;
}

.primary-btn {
  padding: 18rpx 48rpx;
  border-radius: 999rpx;
  background-color: $color-text-primary;
  color: #FFFFFF;
  font-size: 26rpx;
  font-weight: 500;
}

.cart-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.cart-card {
  display: flex;
  align-items: center;
  padding: 24rpx 22rpx;
  border-radius: $radius-md;
  background-color: $color-bg-card;
  border: 1rpx solid $color-border;
}

.check-hit {
  padding: 12rpx 16rpx 12rpx 4rpx;
}

.check-circle {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  border: 2rpx solid #C8C2B7;
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-circle.is-checked {
  background-color: $color-accent;
  border-color: $color-accent;
}

.check-mark {
  font-size: 22rpx;
  color: #FFFFFF;
  font-weight: 600;
}

.item-thumb {
  width: 144rpx;
  height: 144rpx;
  border-radius: $radius-sm;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-right: 20rpx;
}

.thumb-image {
  width: 100%;
  height: 100%;
}

.thumb-dot {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.48);
  border: 2rpx solid rgba(31, 30, 28, 0.14);
}

.item-body {
  flex: 1;
  min-width: 0;
}

.item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.item-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $color-text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-remove {
  flex-shrink: 0;
  font-size: 22rpx;
  color: $color-text-muted;
}

.item-spec {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $color-text-muted;
}

.item-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 22rpx;
}

.item-price {
  font-size: 30rpx;
  font-weight: 600;
  color: $color-accent;
}

.stepper {
  display: flex;
  align-items: center;
  border: 1rpx solid $color-border;
  border-radius: 999rpx;
  background-color: $color-bg-page;
}

.step-btn {
  width: 48rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: $color-text-primary;
}

.step-num {
  min-width: 48rpx;
  text-align: center;
  font-size: 24rpx;
  color: $color-text-primary;
}

.checkout-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: var(--window-bottom, 0);
  height: 112rpx;
  padding: 0 28rpx;
  background-color: #FFFFFF;
  border-top: 1rpx solid $color-border;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 20;
}

.select-all {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.select-all-text {
  font-size: 26rpx;
  color: $color-text-secondary;
}

.checkout-right {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.total-box {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.total-label {
  font-size: 24rpx;
  color: $color-text-secondary;
}

.total-price {
  font-size: 34rpx;
  font-weight: 600;
  color: $color-accent;
}

.checkout-btn {
  padding: 18rpx 34rpx;
  border-radius: 999rpx;
  background-color: $color-text-primary;
  color: #FFFFFF;
  font-size: 26rpx;
  font-weight: 500;
}

.checkout-btn.is-disabled {
  background-color: #C8C2B7;
}
</style>
