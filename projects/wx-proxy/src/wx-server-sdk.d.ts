declare module 'wx-server-sdk' {
  export interface WxContext {
    OPENID?: string
    UNIONID?: string
    APPID?: string
    ENV?: string
  }

  export const DYNAMIC_CURRENT_ENV: unique symbol

  export function init(options?: { env?: string | typeof DYNAMIC_CURRENT_ENV }): void
  export function getWXContext(): WxContext
}
