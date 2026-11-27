import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as pulumi from '@pulumi/pulumi'
import * as random from '@pulumi/random'
import { loadInfraConfig } from './config'
import { provisionCloudflareAdmin } from './resources/cloudflare-pages'
import { provisionFcApi } from './resources/fc'
import { provisionTableStore } from './resources/tablestore'
import { WechatCloudFunction } from './resources/wechat-function'
import { hashPaths } from './utils/hash'

const config = loadInfraConfig()
const workspaceRoot = path.resolve(__dirname, '..', '..', '..')

const proxySharedSecretResource = new random.RandomPassword('proxy-shared-secret', {
  length: 32,
  special: false,
})

const adminApiTokenResource = new random.RandomPassword('admin-api-token', {
  length: 28,
  special: false,
})

const proxySharedSecret = proxySharedSecretResource.result
const adminApiToken = adminApiTokenResource.result

let otsInstanceName: pulumi.Output<string> | undefined
let otsEndpoint: pulumi.Output<string> | undefined
let fcFunctionName: pulumi.Output<string> | undefined
let fcHttpUrl: pulumi.Output<string> | undefined

if (config.enableAliyun) {
  const tablestore = provisionTableStore(config)
  const fcApi = provisionFcApi({
    config,
    workspaceRoot,
    tablestore,
    proxySharedSecret,
    adminApiToken,
  })

  otsInstanceName = tablestore.instance.name
  otsEndpoint = tablestore.endpoint
  fcFunctionName = fcApi.fn.functionName
  fcHttpUrl = fcApi.httpUrl
}

let wxFunctionResource: WechatCloudFunction | undefined
if (config.enableWechat) {
  if (!fcHttpUrl) {
    throw new Error('enableWechat requires enableAliyun=true so FC HTTP URL is available')
  }
  if (!config.wxEnvId) {
    throw new Error('wxEnvId must be set via `pulumi config set wxEnvId <envId>`')
  }

  const wxProxyDir = path.join(workspaceRoot, 'projects', 'wx-proxy')
  const wxProxyDistDir = path.join(wxProxyDir, 'dist')
  const miniappDir = path.join(workspaceRoot, 'projects', 'miniapp')
  const sharedDir = path.join(workspaceRoot, 'projects', 'shared')

  if (!fs.existsSync(path.join(wxProxyDistDir, 'index.js'))) {
    execFileSync('pnpm', ['--filter', '@nectar/wx-proxy', 'build'], {
      cwd: workspaceRoot,
      stdio: 'inherit',
    })
  }

  const wxCodeHash = hashPaths([
    path.join(wxProxyDir, 'src'),
    path.join(wxProxyDir, 'package.json'),
    path.join(sharedDir, 'src'),
  ])

  wxFunctionResource = new WechatCloudFunction('nectar-wx-api-proxy', {
    appId: config.wxAppId,
    envId: config.wxEnvId,
    functionName: config.wxFunctionName,
    miniappDir,
    distDir: wxProxyDistDir,
    codeHash: wxCodeHash,
    fcBaseUrl: fcHttpUrl,
    proxySharedSecret,
    privateKey: config.wxPrivateKey,
    privateKeyPath: config.wxPrivateKeyPath,
  })
}

let adminPagesUrl: pulumi.Output<string> | undefined
if (config.enableCloudflare) {
  if (!fcHttpUrl) {
    throw new Error(
      'enableCloudflare requires enableAliyun=true so FC HTTP URL can be injected'
    )
  }
  const cfAdmin = provisionCloudflareAdmin({
    config,
    workspaceRoot,
    fcHttpUrl,
  })
  adminPagesUrl = cfAdmin.url
}

export {
  adminApiToken,
  adminPagesUrl,
  fcFunctionName,
  fcHttpUrl,
  otsEndpoint,
  otsInstanceName,
  proxySharedSecret,
}

export const wxEnvId = config.wxEnvId
export const wxFunctionName = config.enableWechat ? config.wxFunctionName : undefined
