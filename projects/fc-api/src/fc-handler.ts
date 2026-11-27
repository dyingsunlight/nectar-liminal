import { app } from './app'
import { updateRuntimeStsCredentials } from './store'

export interface FcHttpEvent {
  version?: string
  rawPath?: string
  httpMethod?: string
  headers?: Record<string, string>
  queryParameters?: Record<string, string>
  body?: string
  isBase64Encoded?: boolean
  requestContext?: {
    domainName?: string
    http?: {
      method?: string
      path?: string
    }
  }
}

export interface FcContext {
  requestId?: string
  credentials?: {
    accessKeyId?: string
    accessKeySecret?: string
    securityToken?: string
  }
}

export interface FcHttpResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
  isBase64Encoded: boolean
}

function parseFcEvent(eventInput: Buffer | string | FcHttpEvent): FcHttpEvent {
  if (Buffer.isBuffer(eventInput)) {
    return JSON.parse(eventInput.toString('utf8')) as FcHttpEvent
  }
  if (typeof eventInput === 'string') {
    return JSON.parse(eventInput) as FcHttpEvent
  }
  return eventInput ?? {}
}

function buildRequestUrl(event: FcHttpEvent): string {
  const host = event.headers?.Host || event.headers?.host || event.requestContext?.domainName || 'localhost'
  const rawPath = event.rawPath || event.requestContext?.http?.path || '/'
  const url = new URL(rawPath, `https://${host}`)

  if (event.queryParameters) {
    for (const [key, value] of Object.entries(event.queryParameters)) {
      if (value !== undefined && !url.searchParams.has(key)) {
        url.searchParams.set(key, value)
      }
    }
  }

  return url.toString()
}

export async function handler(
  eventInput: Buffer | string | FcHttpEvent,
  context?: FcContext
): Promise<FcHttpResponse> {
  if (context?.credentials) {
    updateRuntimeStsCredentials(context.credentials)
  }

  const event = parseFcEvent(eventInput)
  const method = (
    event.httpMethod ||
    event.requestContext?.http?.method ||
    'GET'
  ).toUpperCase()

  const headers = new Headers()
  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      if (value !== undefined) {
        headers.set(key, value)
      }
    }
  }

  let requestBody: BodyInit | undefined
  if (event.body && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    requestBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : event.body
  }

  const request = new Request(buildRequestUrl(event), {
    method,
    headers,
    body: requestBody,
  })

  const response = await app.fetch(request)
  const responseHeaders: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value
  })

  return {
    statusCode: response.status,
    headers: responseHeaders,
    body: await response.text(),
    isBase64Encoded: false,
  }
}
