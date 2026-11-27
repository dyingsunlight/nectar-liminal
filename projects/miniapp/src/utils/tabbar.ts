const TAB_BAR_ITEMS = [
  {
    index: 0,
    iconPath: 'static/tabbar/home.png',
    selectedIconPath: 'static/tabbar/home-active.png',
  },
  {
    index: 1,
    iconPath: 'static/tabbar/category.png',
    selectedIconPath: 'static/tabbar/category-active.png',
  },
  {
    index: 2,
    iconPath: 'static/tabbar/cart.png',
    selectedIconPath: 'static/tabbar/cart-active.png',
  },
  {
    index: 3,
    iconPath: 'static/tabbar/mine.png',
    selectedIconPath: 'static/tabbar/mine-active.png',
  },
] as const

interface WxFs {
  readFileSync?: (filePath: string, encoding: 'base64') => string | ArrayBuffer
}

interface WxRuntime {
  getFileSystemManager?: () => WxFs
}

let applied = false

function isWechatDevtools(): boolean {
  try {
    const info = uni.getSystemInfoSync()
    return info?.platform === 'devtools'
  } catch {
    return false
  }
}

function readPackagePngAsDataUri(fs: WxFs, relPath: string): string | null {
  if (typeof fs.readFileSync !== 'function') {
    return null
  }
  const candidates = [relPath, `/${relPath}`]
  for (const candidate of candidates) {
    try {
      const raw = fs.readFileSync(candidate, 'base64')
      if (typeof raw === 'string' && raw.length > 0) {
        return `data:image/png;base64,${raw.replace(/\s+/g, '')}`
      }
    } catch {
      // Try next candidate path
    }
  }
  return null
}

/**
 * 微信开发者工具在项目目录含空格时，原生 tabBar 本地路径图标可能无法加载。
 * 仅在 devtools 环境将打包好的本地 PNG 转为 Data URI 重新设置，不影响真机行为。
 */
export function ensureDevtoolsTabBarIcons(): void {
  if (applied || !isWechatDevtools()) {
    return
  }

  const wxRuntime = (globalThis as { wx?: WxRuntime }).wx
  const uniRuntime = uni as unknown as WxRuntime
  const fs = wxRuntime?.getFileSystemManager?.() ?? uniRuntime.getFileSystemManager?.()
  if (!fs) {
    return
  }

  let pending = TAB_BAR_ITEMS.length
  let allSucceeded = true

  for (const item of TAB_BAR_ITEMS) {
    const iconUri = readPackagePngAsDataUri(fs, item.iconPath)
    const selectedUri = readPackagePngAsDataUri(fs, item.selectedIconPath)
    if (!iconUri || !selectedUri) {
      allSucceeded = false
      pending -= 1
      continue
    }

    uni.setTabBarItem({
      index: item.index,
      iconPath: iconUri,
      selectedIconPath: selectedUri,
      fail: () => {
        allSucceeded = false
      },
      complete: () => {
        pending -= 1
        if (pending === 0 && allSucceeded) {
          applied = true
        }
      },
    })
  }
}
