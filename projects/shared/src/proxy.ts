import type { ApiResponse } from './models'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface WxProxyRequest {
  method?: HttpMethod
  path: string
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  headers?: Record<string, string>
}

export interface WxProxyResponse<T = unknown> {
  statusCode: number
  headers: Record<string, string>
  data: ApiResponse<T>
}

export const HEADER_PROXY_TOKEN = 'x-proxy-token'
export const HEADER_ADMIN_TOKEN = 'x-admin-token'
export const HEADER_WX_OPENID = 'x-wx-openid'
export const HEADER_WX_UNIONID = 'x-wx-unionid'
export const HEADER_WX_APPID = 'x-wx-appid'
export const HEADER_SOURCE_CHANNEL = 'x-source-channel'
export const HEADER_DEV_OPENID = 'x-dev-openid'
