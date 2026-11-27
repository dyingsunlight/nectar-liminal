<script setup lang="ts">
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'
import { useCartStore } from '@/stores/cart'
import { useUserStore } from '@/stores/user'
import { ensureDevtoolsTabBarIcons } from '@/utils/tabbar'

onLaunch(() => {
  console.log('[SUWU] App Launch')
  useCartStore().hydrate()
  const userStore = useUserStore()
  userStore.hydrate()
  if (userStore.isLoggedIn) {
    void userStore.refreshProfile().catch(() => {})
  }
  ensureDevtoolsTabBarIcons()
})

onShow(() => {
  console.log('[SUWU] App Show')
  ensureDevtoolsTabBarIcons()
})

onHide(() => {
  console.log('[SUWU] App Hide')
})
</script>

<style lang="scss">
page {
  background-color: $color-bg-page;
  color: $color-text-primary;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
  font-size: 28rpx;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

view,
text,
scroll-view,
image,
swiper,
swiper-item {
  box-sizing: border-box;
}

button {
  margin: 0;
  padding: 0;
  background-color: transparent;
  line-height: inherit;
  border-radius: 0;
}

button::after {
  border: none;
}
</style>
