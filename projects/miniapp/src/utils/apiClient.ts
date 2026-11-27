import {
  HEADER_DEV_OPENID,
  type ApiResponse,
  type HttpMethod,
  type WxProxyRequest,
  type WxProxyResponse,
} from '@nectar/shared'

export type ApiTransportMode = 'wx-cloud' | 'http'

export interface RequestApiOptions {
  method?: HttpMethod
  path: string
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

interface WxCloudCallResult {
  result?: unknown
  errMsg?: string
}

interface WxCloudNamespace {
  init: (options?: { env?: string; traceUser?: boolean }) => void
  callFunction: (options: {
    name: string
    data: WxProxyRequest
  }) => Promise<WxCloudCallResult>
}

interface WxRuntime {
  cloud?: WxCloudNamespace
}

let cloudInitialized = false

function getWxRuntime(): WxRuntime | undefined {
  const globalObj = globalThis as { wx?: WxRuntime }
  return globalObj.wx
}

export function getApiMode(): ApiTransportMode {
  const explicit = import.meta.env.VITE_API_MODE
  if (explicit === 'wx-cloud' || explicit === 'http') {
    return explicit
  }
  if (import.meta.env.VITE_WX_CLOUD_ENV_ID) {
    return 'wx-cloud'
  }
  if (import.meta.env.VITE_API_BASE_URL) {
    return 'http'
  }
  throw new Error(
    '未配置后端连接，请设置 VITE_API_MODE（wx-cloud 或 http）及对应环境变量'
  )
}

function buildQueryString(
  query?: Record<string, string | number | boolean | undefined>
): string {
  if (!query) {
    return ''
  }
  const pairs: string[] = []
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    }
  }
  return pairs.length > 0 ? `?${pairs.join('&')}` : ''
}

function isWxProxyResponse<T>(value: unknown): value is WxProxyResponse<T> {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Partial<WxProxyResponse<T>>
  return (
    typeof candidate.statusCode === 'number' &&
    typeof candidate.data === 'object' &&
    candidate.data !== null
  )
}

function ensureWxCloudReady(): WxCloudNamespace {
  const wxRuntime = getWxRuntime()
  if (!wxRuntime?.cloud) {
    throw new Error('当前运行环境不支持 wx.cloud 云开发能力')
  }
  if (!cloudInitialized) {
    const envId = import.meta.env.VITE_WX_CLOUD_ENV_ID
    wxRuntime.cloud.init(envId ? { env: envId, traceUser: true } : { traceUser: true })
    cloudInitialized = true
  }
  return wxRuntime.cloud
}

async function callViaWxCloud<T>(options: RequestApiOptions): Promise<ApiResponse<T>> {
  const cloud = ensureWxCloudReady()
  const functionName = import.meta.env.VITE_WX_PROXY_FUNCTION || 'apiProxy'

  const response = await cloud.callFunction({
    name: functionName,
    data: {
      method: options.method ?? 'GET',
      path: options.path,
      query: options.query,
      body: options.body,
    },
  })

  if (isWxProxyResponse<T>(response.result)) {
    return response.result.data
  }

  return {
    code: 502,
    message: '云函数返回格式异常',
    data: null as unknown as T,
  }
}

async function callViaHttp<T>(options: RequestApiOptions): Promise<ApiResponse<T>> {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
  if (!baseUrl) {
    throw new Error('未配置 VITE_API_BASE_URL')
  }

  const url = `${baseUrl}${options.path}${buildQueryString(options.query)}`
  const method = options.method ?? 'GET'
  if (method === 'PATCH') {
    throw new Error('uni.request 不支持 PATCH 方法')
  }

  const devOpenId = import.meta.env.VITE_DEV_OPENID || 'local-dev-user'

  return new Promise<ApiResponse<T>>((resolve, reject) => {
    uni.request({
      url,
      method,
      data: options.body as string | Record<string, unknown> | ArrayBuffer | undefined,
      header: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        [HEADER_DEV_OPENID]: devOpenId,
      },
      success: (res) => {
        const payload = res.data as ApiResponse<T> | undefined
        if (payload && typeof payload.code === 'number') {
          resolve(payload)
          return
        }
        resolve({
          code: res.statusCode || 500,
          message: '接口响应格式异常',
          data: null as unknown as T,
        })
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '网络请求失败'))
      },
    })
  })
}

export async function requestApi<T>(options: RequestApiOptions): Promise<ApiResponse<T>> {
  const mode = getApiMode()
  if (mode === 'wx-cloud') {
    return callViaWxCloud<T>(options)
  }
  return callViaHttp<T>(options)
}
