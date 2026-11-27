const SOFT_LIMIT_BYTES = 90 * 1024
const HARD_LIMIT_BYTES = 95 * 1024

interface WxCompressImageOptions {
  src: string
  quality?: number
  compressedWidth?: number
  success?: (res: { tempFilePath?: string }) => void
  fail?: () => void
}

interface WxFileSystemManager {
  readFile: (options: {
    filePath: string
    encoding: 'base64'
    success?: (res: { data: string | ArrayBuffer }) => void
    fail?: (err: { errMsg?: string }) => void
  }) => void
}

interface WxAvatarRuntime {
  compressImage?: (options: WxCompressImageOptions) => void
  getFileSystemManager?: () => WxFileSystemManager
}

function getWxRuntime(): WxAvatarRuntime | undefined {
  const globalObj = globalThis as { wx?: WxAvatarRuntime }
  return globalObj.wx
}

function inferImageMime(filePath: string): string {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.png')) {
    return 'image/png'
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp'
  }
  return 'image/jpeg'
}

function tryCompressImage(
  wxRuntime: WxAvatarRuntime | undefined,
  src: string,
  quality: number,
  compressedWidth: number
): Promise<string> {
  if (typeof wxRuntime?.compressImage !== 'function') {
    return Promise.resolve(src)
  }
  return new Promise((resolve) => {
    wxRuntime.compressImage?.({
      src,
      quality,
      compressedWidth,
      success: (res) => {
        resolve(res.tempFilePath || src)
      },
      fail: () => {
        resolve(src)
      },
    })
  })
}

function readFileAsDataUri(
  fs: WxFileSystemManager,
  filePath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile({
      filePath,
      encoding: 'base64',
      success: (res) => {
        if (typeof res.data !== 'string' || !res.data) {
          reject(new Error('读取头像文件失败'))
          return
        }
        const cleaned = res.data.replace(/\s+/g, '')
        const mime = inferImageMime(filePath)
        resolve(`data:${mime};base64,${cleaned}`)
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '读取头像文件失败'))
      },
    })
  })
}

export async function compressAvatarToDataUri(tempFilePath: string): Promise<string> {
  const wxRuntime = getWxRuntime()
  const uniRuntime = uni as unknown as WxAvatarRuntime
  const fs = wxRuntime?.getFileSystemManager?.() ?? uniRuntime.getFileSystemManager?.()

  if (!fs || typeof fs.readFile !== 'function') {
    throw new Error('请在微信小程序中选择微信头像')
  }

  const firstCompressed = await tryCompressImage(wxRuntime, tempFilePath, 70, 160)
  let dataUri = await readFileAsDataUri(fs, firstCompressed)

  if (dataUri.length > SOFT_LIMIT_BYTES) {
    const secondCompressed = await tryCompressImage(wxRuntime, tempFilePath, 45, 128)
    dataUri = await readFileAsDataUri(fs, secondCompressed)
  }

  if (dataUri.length > HARD_LIMIT_BYTES) {
    throw new Error('头像图片过大，请重新选择较小的图片')
  }

  return dataUri
}
