import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import cloud, { type WxContext } from 'wx-server-sdk'
import {
  HEADER_PROXY_TOKEN,
  HEADER_SOURCE_CHANNEL,
  HEADER_WX_APPID,
  HEADER_WX_OPENID,
  HEADER_WX_UNIONID,
  type ApiResponse,
  type HttpMethod,
  type WxProxyRequest,
  type WxProxyResponse,
} from '@nectar/shared'

export interface RuntimeConfig {
  fcBaseUrl?: string
  proxySharedSecret?: string
}

const ALLOWED_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
])

const REQUEST_TIMEOUT_MS = 10_000

let sdkInitialized = false

function ensureCloudInit(): void {
  if (!sdkInitialized && process.env.WX_PROXY_SKIP_SDK !== '1') {
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    sdkInitialized = true
  }
}

function loadRuntimeConfig(overrides?: RuntimeConfig): RuntimeConfig {
  let fileConfig: RuntimeConfig = {}
  const configPath = path.join(__dirname, 'runtime-config.json')
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8')
      fileConfig = JSON.parse(raw) as RuntimeConfig
    } catch {
      fileConfig = {}
    }
  }

  return {
    fcBaseUrl:
      overrides?.fcBaseUrl ||
      process.env.FC_BASE_URL ||
      fileConfig.fcBaseUrl ||
      '',
    proxySharedSecret:
      overrides?.proxySharedSecret ||
      process.env.PROXY_SHARED_SECRET ||
      fileConfig.proxySharedSecret ||
      '',
  }
}

function validateProxyPath(reqPath: unknown): string {
  if (typeof reqPath !== 'string' || !reqPath.startsWith('/api/')) {
    throw new Error('Invalid proxy path: must start with /api/')
  }
  if (
    reqPath.includes('..') ||
    reqPath.includes('//') ||
    reqPath.includes('\\') ||
    reqPath.includes('\r') ||
    reqPath.includes('\n') ||
    reqPath.includes('://')
  ) {
    throw new Error('Invalid proxy path: forbidden sequence')
  }
  return reqPath
}

function normalizeMethod(method: unknown): HttpMethod {
  const upper = typeof method === 'string' ? method.toUpperCase() : 'GET'
  if (!ALLOWED_METHODS.has(upper)) {
    throw new Error(`Unsupported HTTP method: ${upper}`)
  }
  return upper as HttpMethod
}

function buildTargetUrl(
  fcBaseUrl: string,
  reqPath: string,
  query?: Record<string, string | number | boolean | undefined>
): URL {
  if (!fcBaseUrl) {
    throw new Error('FC_BASE_URL is not configured')
  }
  const normalizedBase = fcBaseUrl.replace(/\/+$/, '')
  const url = new URL(`${normalizedBase}${reqPath}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url
}

function sendHttpRequest(
  targetUrl: URL,
  method: HttpMethod,
  headers: Record<string, string>,
  bodyText?: string
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const transport = targetUrl.protocol === 'https:' ? https : http
    const req = transport.request(
      targetUrl,
      {
        method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer | string) => {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
        })
        res.on('end', () => {
          const flatHeaders: Record<string, string> = {}
          for (const [key, val] of Object.entries(res.headers)) {
            if (typeof val === 'string') {
              flatHeaders[key] = val
            } else if (Array.isArray(val)) {
              flatHeaders[key] = val.join(', ')
            }
          }
          resolve({
            statusCode: res.statusCode ?? 502,
            headers: flatHeaders,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        })
      }
    )

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('Upstream FC request timed out'))
    })

    req.on('error', (err) => {
      reject(err)
    })

    if (bodyText !== undefined) {
      req.write(bodyText)
    }
    req.end()
  })
}

export async function forwardToFc(
  event: WxProxyRequest,
  wxContext: WxContext,
  configOverrides?: RuntimeConfig
): Promise<WxProxyResponse> {
  try {
    const method = normalizeMethod(event?.method)
    const reqPath = validateProxyPath(event?.path)
    const config = loadRuntimeConfig(configOverrides)
    const targetUrl = buildTargetUrl(config.fcBaseUrl || '', reqPath, event?.query)

    const hasBody =
      event?.body !== undefined && method !== 'GET'
    const bodyText = hasBody ? JSON.stringify(event.body) : undefined

    const forwardHeaders: Record<string, string> = {
      accept: 'application/json',
      [HEADER_SOURCE_CHANNEL]: 'wechat-miniprogram',
      [HEADER_WX_OPENID]: wxContext.OPENID || '',
      [HEADER_WX_UNIONID]: wxContext.UNIONID || '',
      [HEADER_WX_APPID]: wxContext.APPID || '',
    }

    if (config.proxySharedSecret) {
      forwardHeaders[HEADER_PROXY_TOKEN] = config.proxySharedSecret
    }

    if (bodyText !== undefined) {
      forwardHeaders['content-type'] = 'application/json'
      forwardHeaders['content-length'] = String(Buffer.byteLength(bodyText, 'utf8'))
    }

    const upstream = await sendHttpRequest(targetUrl, method, forwardHeaders, bodyText)

    let parsedData: ApiResponse<unknown>
    try {
      parsedData = JSON.parse(upstream.body) as ApiResponse<unknown>
    } catch {
      parsedData = {
        code: upstream.statusCode,
        message: upstream.body || 'Upstream returned non-JSON response',
        data: null,
      }
    }

    return {
      statusCode: upstream.statusCode,
      headers: upstream.headers,
      data: parsedData,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy forwarding failed'
    return {
      statusCode: 400,
      headers: {},
      data: {
        code: 400,
        message,
        data: null,
      },
    }
  }
}

export async function main(event: WxProxyRequest): Promise<WxProxyResponse> {
  ensureCloudInit()
  const wxContext =
    process.env.WX_PROXY_SKIP_SDK === '1'
      ? {}
      : cloud.getWXContext()
  return forwardToFc(event, wxContext)
}
