/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE?: 'wx-cloud' | 'http'
  readonly VITE_WX_CLOUD_ENV_ID?: string
  readonly VITE_WX_PROXY_FUNCTION?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_DEV_OPENID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}
