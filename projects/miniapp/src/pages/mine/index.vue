<template>
  <view class="mine-page">
    <!-- 用户信息卡片 -->
    <view class="profile-card">
      <!-- 未登录态 -->
      <template v-if="!userStore.isLoggedIn || !profile">
        <view class="profile-main">
          <view class="avatar-circle">
            <text class="avatar-text">素</text>
          </view>
          <view class="profile-info">
            <text class="nickname">登录素物集</text>
            <text class="profile-tip">微信一键登录，同步你的会员档案与积分</text>
          </view>
        </view>
        <button
          class="login-btn"
          :disabled="userStore.loading"
          @tap="handleWechatLogin"
        >
          {{ userStore.loading ? '正在登录…' : '微信一键登录' }}
        </button>
      </template>

      <!-- 已登录态 -->
      <template v-else>
        <view class="profile-main">
          <view class="avatar-circle" @tap="openEditModal">
            <image
              v-if="profile.avatarUrl"
              class="avatar-image"
              :src="profile.avatarUrl"
              mode="aspectFill"
            />
            <text v-else class="avatar-text">{{ profile.avatarText || '素' }}</text>
          </view>
          <view class="profile-info">
            <view class="name-row">
              <text class="nickname">{{ profile.nickname }}</text>
              <text class="member-badge">{{ profile.memberLevel }}</text>
            </view>
            <view class="sub-row">
              <text class="profile-tip">会员编号 {{ profile.id }}</text>
              <text class="edit-pill" @tap="openEditModal">编辑资料</text>
            </view>
          </view>
        </view>

        <view class="assets-row">
          <view class="asset-item" @tap="showPlaceholder('积分明细')">
            <text class="asset-value">{{ profile.points }}</text>
            <text class="asset-label">生活积分</text>
          </view>
          <view class="asset-divider" />
          <view class="asset-item" @tap="showPlaceholder('优惠券')">
            <text class="asset-value">{{ profile.couponCount }}</text>
            <text class="asset-label">礼遇券</text>
          </view>
        </view>
      </template>
    </view>

    <!-- 我的订单 -->
    <view class="panel-card">
      <view class="panel-header" @tap="showPlaceholder('全部订单')">
        <text class="panel-title">我的订单</text>
        <text class="panel-more">全部订单 →</text>
      </view>

      <view class="order-grid">
        <view
          v-for="orderItem in orderStatusList"
          :key="orderItem.label"
          class="order-cell"
          @tap="showPlaceholder(orderItem.label)"
        >
          <text class="order-count">{{ orderItem.count }}</text>
          <text class="order-label">{{ orderItem.label }}</text>
        </view>
      </view>
    </view>

    <!-- 常用功能列表 -->
    <view class="panel-card menu-card">
      <view
        v-for="menu in menuItems"
        :key="menu.title"
        class="menu-row"
        @tap="handleMenuTap(menu.title)"
      >
        <text class="menu-title">{{ menu.title }}</text>
        <text class="menu-arrow">{{ menu.extra }} →</text>
      </view>
    </view>

    <!-- 退出登录 -->
    <button
      v-if="userStore.isLoggedIn"
      class="logout-btn"
      @tap="handleLogout"
    >
      退出登录
    </button>

    <!-- 编辑头像与昵称弹窗 -->
    <view v-if="showEditModal" class="modal-mask" @tap.self="closeEditModal">
      <view class="modal-card">
        <view class="modal-header">
          <text class="modal-title">完善个人资料</text>
          <text class="modal-close" @tap="closeEditModal">跳过</text>
        </view>

        <form @submit="handleSaveProfile">
          <view class="avatar-picker-wrap">
            <button
              class="avatar-picker-btn"
              open-type="chooseAvatar"
              @chooseavatar="handleChooseAvatar"
            >
              <image
                v-if="draftAvatarUrl"
                class="avatar-picker-img"
                :src="draftAvatarUrl"
                mode="aspectFill"
              />
              <text v-else class="avatar-picker-text">{{ draftAvatarText }}</text>
              <text class="avatar-picker-hint">点击选择微信头像</text>
            </button>
            <text
              v-if="draftAvatarUrl"
              class="clear-avatar-link"
              @tap="draftAvatarUrl = ''"
            >
              恢复默认文字头像
            </text>
          </view>

          <view class="form-field">
            <text class="form-label">昵称</text>
            <input
              class="nickname-input"
              type="nickname"
              name="nickname"
              :value="draftNickname"
              placeholder="请输入昵称（支持快捷填入微信昵称）"
              maxlength="32"
              @input="onNicknameInput"
              @blur="onNicknameBlur"
            />
          </view>

          <view class="modal-actions">
            <button class="modal-btn modal-btn-cancel" @tap="closeEditModal">
              取消
            </button>
            <button
              class="modal-btn modal-btn-save"
              form-type="submit"
              :disabled="savingProfile"
            >
              {{ savingProfile ? '保存中…' : '保存资料' }}
            </button>
          </view>
        </form>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { compressAvatarToDataUri } from '@/utils/avatar'

function getDetailObject(event: unknown): Record<string, unknown> | null {
  if (typeof event !== 'object' || event === null) {
    return null
  }
  const detail = (event as { detail?: unknown }).detail
  if (typeof detail !== 'object' || detail === null) {
    return null
  }
  return detail as Record<string, unknown>
}

function getInputStringValue(event: unknown): string | undefined {
  const detail = getDetailObject(event)
  if (typeof detail?.value === 'string') {
    return detail.value
  }
  if (typeof event === 'object' && event !== null) {
    const target = (event as { target?: unknown }).target
    if (typeof target === 'object' && target !== null) {
      const value = (target as { value?: unknown }).value
      if (typeof value === 'string') {
        return value
      }
    }
  }
  return undefined
}

const userStore = useUserStore()
const profile = computed(() => userStore.profile)

const showEditModal = ref(false)
const savingProfile = ref(false)
const draftNickname = ref('')
const draftAvatarUrl = ref('')

const draftAvatarText = computed(
  () => Array.from(draftNickname.value.trim())[0] || profile.value?.avatarText || '素'
)

const orderStatusList = computed(() => [
  { label: '待付款', count: profile.value?.stats.unpaid ?? 0 },
  { label: '待发货', count: profile.value?.stats.unshipped ?? 0 },
  { label: '待收货', count: profile.value?.stats.shipped ?? 0 },
  { label: '退换售后', count: profile.value?.stats.afterSale ?? 0 },
])

const menuItems = computed(() => [
  { title: '收货地址管理', extra: '待扩展' },
  {
    title: '我的优惠券',
    extra: userStore.isLoggedIn ? `${profile.value?.couponCount ?? 0} 张可用` : '登录后查看',
  },
  { title: '联系客服', extra: '待接入' },
  { title: '关于素物集', extra: 'v0.2.0' },
])

function openEditModal() {
  draftNickname.value = profile.value?.nickname || ''
  draftAvatarUrl.value = profile.value?.avatarUrl || ''
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
}

async function handleWechatLogin() {
  try {
    const result = await userStore.login()
    uni.showToast({
      title: result.isNewUser ? '欢迎加入素物集' : '登录成功',
      icon: 'success',
    })
    if (result.isNewUser) {
      openEditModal()
    }
  } catch (err) {
    uni.showToast({
      title: err instanceof Error ? err.message : '登录失败，请稍后重试',
      icon: 'none',
    })
  }
}

async function handleChooseAvatar(e: unknown) {
  const detail = getDetailObject(e)
  const tempPath = typeof detail?.avatarUrl === 'string' ? detail.avatarUrl : ''
  if (!tempPath) return
  try {
    uni.showLoading({ title: '处理头像中…' })
    draftAvatarUrl.value = await compressAvatarToDataUri(tempPath)
  } catch (err) {
    uni.showToast({
      title: err instanceof Error ? err.message : '头像处理失败',
      icon: 'none',
    })
  } finally {
    uni.hideLoading()
  }
}

function onNicknameInput(e: unknown) {
  const val = getInputStringValue(e)
  if (typeof val === 'string') {
    draftNickname.value = val
  }
}

function onNicknameBlur(e: unknown) {
  const val = getInputStringValue(e)
  if (typeof val === 'string') {
    draftNickname.value = val
  }
}

async function handleSaveProfile(e: unknown) {
  if (savingProfile.value) return
  const detail = getDetailObject(e)
  const formValue =
    detail && typeof detail.value === 'object' && detail.value !== null
      ? (detail.value as Record<string, unknown>)
      : null
  const submitted = formValue?.nickname
  const nickname = (
    typeof submitted === 'string' && submitted.trim()
      ? submitted
      : draftNickname.value
  ).trim()

  if (!nickname) {
    uni.showToast({
      title: '请输入昵称',
      icon: 'none',
    })
    return
  }

  savingProfile.value = true
  try {
    await userStore.updateProfile({
      nickname,
      avatarUrl: draftAvatarUrl.value,
    })
    showEditModal.value = false
    uni.showToast({
      title: '资料已保存',
      icon: 'success',
    })
  } catch (err) {
    uni.showToast({
      title: err instanceof Error ? err.message : '保存失败',
      icon: 'none',
    })
  } finally {
    savingProfile.value = false
  }
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确认退出当前微信账号吗？退出后本地缓存将被清除。',
    confirmColor: '#B66A49',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
        uni.showToast({
          title: '已退出登录',
          icon: 'none',
        })
      }
    },
  })
}

function showPlaceholder(name: string) {
  if (!userStore.isLoggedIn) {
    uni.showToast({
      title: '请先登录微信账号',
      icon: 'none',
    })
    return
  }
  uni.showToast({
    title: `${name}模块待接入`,
    icon: 'none',
  })
}

function handleMenuTap(title: string) {
  if (title === '关于素物集') {
    uni.showModal({
      title: '素物集 · SUWU ATELIER',
      content:
        '基于 uni-app、微信云函数与阿里云 FC / TableStore 打造的精品生活商城小程序，已接入微信身份认证与个人档案同步。',
      showCancel: false,
      confirmColor: '#B66A49',
    })
    return
  }
  showPlaceholder(title)
}

onShow(() => {
  userStore.hydrate()
  if (userStore.isLoggedIn) {
    void userStore.refreshProfile().catch(() => {})
  }
})

onPullDownRefresh(async () => {
  try {
    if (userStore.isLoggedIn) {
      await userStore.refreshProfile()
    }
  } catch (err) {
    uni.showToast({
      title: err instanceof Error ? err.message : '刷新失败',
      icon: 'none',
    })
  } finally {
    uni.stopPullDownRefresh()
  }
})
</script>

<style lang="scss" scoped>
.mine-page {
  padding: 24rpx 28rpx 48rpx;
}

.profile-card {
  padding: 32rpx;
  border-radius: $radius-lg;
  background-color: $color-bg-card;
  border: 1rpx solid $color-border;
  margin-bottom: 24rpx;
}

.profile-main {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.avatar-circle {
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  background-color: $color-accent-soft;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-image {
  width: 100%;
  height: 100%;
}

.avatar-text {
  font-size: 40rpx;
  font-weight: 600;
  color: $color-accent;
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.nickname {
  font-size: 34rpx;
  font-weight: 600;
  color: $color-text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-badge {
  flex-shrink: 0;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  background-color: $color-bg-muted;
  color: $color-text-secondary;
  font-size: 20rpx;
}

.sub-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 8rpx;
}

.profile-tip {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $color-text-muted;
}

.sub-row .profile-tip {
  margin-top: 0;
}

.edit-pill {
  flex-shrink: 0;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  background-color: $color-bg-muted;
  color: $color-text-primary;
  font-size: 21rpx;
}

.login-btn {
  margin-top: 28rpx;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 999rpx;
  background-color: $color-text-primary;
  color: #FFFFFF;
  font-size: 28rpx;
  font-weight: 500;
  text-align: center;
}

.assets-row {
  display: flex;
  align-items: center;
  margin-top: 30rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid $color-border;
}

.asset-item {
  flex: 1;
  text-align: center;
}

.asset-value {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: $color-text-primary;
}

.asset-label {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: $color-text-muted;
}

.asset-divider {
  width: 1rpx;
  height: 44rpx;
  background-color: $color-border;
}

.panel-card {
  padding: 28rpx 30rpx;
  border-radius: $radius-md;
  background-color: $color-bg-card;
  border: 1rpx solid $color-border;
  margin-bottom: 24rpx;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.panel-title {
  font-size: 29rpx;
  font-weight: 600;
  color: $color-text-primary;
}

.panel-more {
  font-size: 23rpx;
  color: $color-text-muted;
}

.order-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
}

.order-cell {
  padding: 12rpx 0;
  text-align: center;
}

.order-count {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: $color-text-primary;
}

.order-label {
  display: block;
  margin-top: 6rpx;
  font-size: 23rpx;
  color: $color-text-secondary;
}

.menu-card {
  padding: 8rpx 30rpx;
}

.menu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx 0;
  border-bottom: 1rpx solid $color-border;
}

.menu-row:last-child {
  border-bottom: none;
}

.menu-title {
  font-size: 27rpx;
  color: $color-text-primary;
}

.menu-arrow {
  font-size: 23rpx;
  color: $color-text-muted;
}

.logout-btn {
  margin-top: 12rpx;
  height: 82rpx;
  line-height: 82rpx;
  border-radius: $radius-md;
  background-color: $color-bg-card;
  border: 1rpx solid $color-border;
  color: $color-text-secondary;
  font-size: 27rpx;
  text-align: center;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background-color: rgba(31, 30, 28, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  z-index: 99;
}

.modal-card {
  width: 100%;
  padding: 36rpx 32rpx;
  border-radius: $radius-lg;
  background-color: $color-bg-card;
  border: 1rpx solid $color-border;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28rpx;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $color-text-primary;
}

.modal-close {
  font-size: 25rpx;
  color: $color-text-muted;
}

.avatar-picker-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 28rpx;
}

.avatar-picker-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
}

.avatar-picker-img {
  width: 132rpx;
  height: 132rpx;
  border-radius: 50%;
  border: 2rpx solid $color-border;
}

.avatar-picker-text {
  width: 132rpx;
  height: 132rpx;
  line-height: 132rpx;
  text-align: center;
  border-radius: 50%;
  background-color: $color-accent-soft;
  color: $color-accent;
  font-size: 48rpx;
  font-weight: 600;
}

.avatar-picker-hint {
  font-size: 23rpx;
  color: $color-accent;
}

.clear-avatar-link {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: $color-text-muted;
}

.form-field {
  margin-bottom: 32rpx;
}

.form-label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 24rpx;
  color: $color-text-secondary;
}

.nickname-input {
  height: 82rpx;
  padding: 0 24rpx;
  border-radius: $radius-sm;
  background-color: $color-bg-page;
  border: 1rpx solid $color-border;
  font-size: 28rpx;
  color: $color-text-primary;
}

.modal-actions {
  display: flex;
  gap: 18rpx;
}

.modal-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 999rpx;
  font-size: 27rpx;
  text-align: center;
}

.modal-btn-cancel {
  background-color: $color-bg-muted;
  color: $color-text-secondary;
}

.modal-btn-save {
  background-color: $color-text-primary;
  color: #FFFFFF;
  font-weight: 500;
}
</style>
