import * as pulumi from '@pulumi/pulumi'

export interface WechatCloudFunctionArgs {
  appId: pulumi.Input<string>
  envId: pulumi.Input<string>
  functionName: pulumi.Input<string>
  miniappDir: pulumi.Input<string>
  distDir: pulumi.Input<string>
  codeHash: pulumi.Input<string>
  fcBaseUrl: pulumi.Input<string>
  proxySharedSecret: pulumi.Input<string>
  privateKey?: pulumi.Input<string>
  privateKeyPath?: pulumi.Input<string>
}

interface WechatCloudFunctionInputs {
  appId: string
  envId: string
  functionName: string
  miniappDir: string
  distDir: string
  codeHash: string
  fcBaseUrl: string
  proxySharedSecret: string
  privateKey?: string
  privateKeyPath?: string
}

interface WechatCloudFunctionOutputs {
  appId: string
  envId: string
  functionName: string
  miniappDir: string
  distDir: string
  codeHash: string
  fcBaseUrl: string
  proxySharedSecret?: string
  filesCount: number
  packSize: number
}

async function deployViaMiniprogramCi(
  inputs: WechatCloudFunctionInputs
): Promise<WechatCloudFunctionOutputs> {
  const fs = require('node:fs') as typeof import('node:fs')
  const os = require('node:os') as typeof import('node:os')
  const path = require('node:path') as typeof import('node:path')
  const ci = require('miniprogram-ci') as typeof import('miniprogram-ci')

  interface TransactOpts {
    request: (req: unknown) => Promise<unknown>
    transactType: unknown
  }

  interface TcbEnvItem {
    envId?: string
    functions?: Array<{ region?: string }>
    logServices?: Array<{ logsetId?: string; topicId?: string }>
  }

  interface ScfFunctionInfo {
    functionName?: string
    status?: string
    statusDesc?: string
    runtime?: string
  }

  interface EnvVarEntry {
    key: string
    value: string
  }

  interface CloudApiHelper {
    initCloudAPI: (appId: string) => void
    boundTransactRequest: (project: unknown) => (req: unknown) => Promise<unknown>
    get3rdCloudCodeSecret: (project: unknown) => Promise<string | undefined>
  }

  interface CommonCloudApi {
    TransactType: { IDE: unknown }
    tcbGetEnvironments: (
      params: Record<string, unknown>,
      opts: TransactOpts
    ) => Promise<{ envList?: TcbEnvItem[] }>
    scfGetFunctionInfo: (
      params: {
        namespace: string
        region: string
        functionName: string
        codeSecret?: string
      },
      opts: TransactOpts
    ) => Promise<ScfFunctionInfo>
    scfCreateFunction: (
      params: {
        functionName: string
        code: { zipFile: string }
        handler: string
        description: string
        memorySize: number
        timeout: number
        environment: { variables: EnvVarEntry[] }
        role: string
        runtime: string
        namespace: string
        region: string
        stamp: string
        installDependency: boolean
        codeSecret?: string
        clsLogsetId?: string
        clsTopicId?: string
      },
      opts: TransactOpts
    ) => Promise<unknown>
    scfUpdateFunctionInfo: (
      params: {
        namespace: string
        region: string
        functionName: string
        runtime: string
        memorySize: number
        timeout: number
        installDependency: boolean
        environment: { variables: EnvVarEntry[] }
        clsLogsetId?: string
        clsTopicId?: string
      },
      opts: TransactOpts
    ) => Promise<unknown>
    scfUpdateFunction: (
      params: {
        functionName: string
        namespace: string
        region: string
        handler: string
        installDependency: boolean
        fileData: string
        codeSecret?: string
      },
      opts: TransactOpts
    ) => Promise<unknown>
  }

  interface CloudZipUtils {
    zipFile: (
      dirPath: string,
      options?: { ignore?: string[] }
    ) => { files?: Record<string, unknown> }
    zipToBuffer: (zip: unknown) => Promise<Buffer>
  }

  const cloudapi = require('miniprogram-ci/dist/ci/cloud/cloudapi') as CloudApiHelper
  const cloudAPI = require('miniprogram-ci/dist/common/cloud-api') as CommonCloudApi
  const cloudUtils = require('miniprogram-ci/dist/ci/cloud/utils') as CloudZipUtils

  if (!inputs.envId) {
    throw new Error('wxEnvId is required to deploy WeChat Cloud Function')
  }
  if (!inputs.privateKey && !inputs.privateKeyPath) {
    throw new Error(
      'Either wxPrivateKey (secret) or wxPrivateKeyPath must be configured for miniprogram-ci'
    )
  }
  if (inputs.privateKey && !inputs.privateKey.includes('PRIVATE KEY')) {
    const looksLikeAppSecret = /^[a-f0-9]{32}$/i.test(inputs.privateKey.trim())
    throw new Error(
      looksLikeAppSecret
        ? 'wxPrivateKey appears to be a 32-char Mini Program AppSecret, but miniprogram-ci requires the RSA private key PEM content (-----BEGIN RSA PRIVATE KEY-----) downloaded from WeChat MP Console -> 开发管理 -> 开发设置 -> 小程序代码上传'
        : 'wxPrivateKey must contain a valid RSA PRIVATE KEY PEM block (-----BEGIN RSA PRIVATE KEY-----)'
    )
  }
  if (!fs.existsSync(path.join(inputs.distDir, 'index.js'))) {
    throw new Error(
      `wx-proxy build output missing at ${inputs.distDir}; run pnpm build:wx-proxy first`
    )
  }

  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nectar-wx-fn-'))
  let tempKeyPath: string | undefined

  try {
    fs.cpSync(inputs.distDir, stageDir, { recursive: true })
    fs.writeFileSync(
      path.join(stageDir, 'runtime-config.json'),
      JSON.stringify(
        {
          fcBaseUrl: inputs.fcBaseUrl,
          proxySharedSecret: inputs.proxySharedSecret,
        },
        null,
        2
      ),
      'utf8'
    )

    let resolvedKeyPath = inputs.privateKeyPath
    if (inputs.privateKey) {
      tempKeyPath = path.join(os.tmpdir(), `nectar-wx-key-${Date.now()}.key`)
      fs.writeFileSync(tempKeyPath, inputs.privateKey, { encoding: 'utf8', mode: 0o600 })
      resolvedKeyPath = tempKeyPath
    }

    const project = new ci.Project({
      appid: inputs.appId,
      type: 'miniProgram',
      projectPath: inputs.miniappDir,
      privateKeyPath: resolvedKeyPath,
      ignores: ['node_modules/**/*', 'dist/**/*'],
    })

    const extAppId = await project.getExtAppid()
    cloudapi.initCloudAPI(extAppId || project.appid)
    const topts: TransactOpts = {
      request: cloudapi.boundTransactRequest(project),
      transactType: cloudAPI.TransactType.IDE,
    }

    const { envList } = await cloudAPI.tcbGetEnvironments({}, topts)
    const targetEnv = (envList || []).find((e) => e.envId === inputs.envId)
    if (!targetEnv) {
      throw new Error(
        `WeChat Cloud environment '${inputs.envId}' not found for AppID ${inputs.appId}`
      )
    }

    const region = targetEnv.functions?.[0]?.region || 'ap-shanghai'
    const clsLogsetId = targetEnv.logServices?.[0]?.logsetId
    const clsTopicId = targetEnv.logServices?.[0]?.topicId
    const codeSecret = await cloudapi.get3rdCloudCodeSecret(project)

    const zipObj = cloudUtils.zipFile(stageDir, { ignore: ['node_modules'] })
    const zipBuffer = await cloudUtils.zipToBuffer(zipObj)
    const filesCount = Object.keys(zipObj.files || {}).length

    const waitUntilActive = async (): Promise<ScfFunctionInfo> => {
      const deadline = Date.now() + 180_000
      while (Date.now() < deadline) {
        const info = await cloudAPI.scfGetFunctionInfo(
          {
            namespace: inputs.envId,
            region,
            functionName: inputs.functionName,
            codeSecret,
          },
          topts
        )
        if (info.status === 'Active') {
          return info
        }
        if (
          info.status === 'CreateFailed' ||
          info.status === 'UpdateFailed' ||
          info.status === 'DeleteFailed'
        ) {
          throw new Error(
            `WeChat Cloud Function status=${info.status}: ${info.statusDesc || ''}`
          )
        }
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
      throw new Error(
        `Timed out waiting for WeChat Cloud Function '${inputs.functionName}' to become Active`
      )
    }

    let existing: ScfFunctionInfo | undefined
    try {
      existing = await cloudAPI.scfGetFunctionInfo(
        {
          namespace: inputs.envId,
          region,
          functionName: inputs.functionName,
          codeSecret,
        },
        topts
      )
    } catch (err) {
      const errCode = (err as { code?: string } | null)?.code
      const errMessage = err instanceof Error ? err.message : String(err)
      if (
        errCode !== 'ResourceNotFound.Function' &&
        !errMessage.includes('ResourceNotFound.Function')
      ) {
        throw err
      }
    }

    const envVars: EnvVarEntry[] = [
      { key: 'FC_BASE_URL', value: inputs.fcBaseUrl },
      { key: 'PROXY_SHARED_SECRET', value: inputs.proxySharedSecret },
    ]

    if (!existing) {
      await cloudAPI.scfCreateFunction(
        {
          functionName: inputs.functionName,
          code: { zipFile: zipBuffer.toString('base64') },
          handler: 'index.main',
          description: 'Nectar Liminal API Proxy managed by Pulumi',
          memorySize: 256,
          timeout: 15,
          environment: { variables: envVars },
          role: 'TCB_QcsRole',
          runtime: 'Nodejs18.15',
          namespace: inputs.envId,
          region,
          stamp: 'MINI_QCBASE',
          installDependency: true,
          codeSecret,
          clsLogsetId,
          clsTopicId,
        },
        topts
      )
      await waitUntilActive()
    } else {
      if (existing.status !== 'Active') {
        await waitUntilActive()
      }
      await cloudAPI.scfUpdateFunctionInfo(
        {
          functionName: inputs.functionName,
          region,
          namespace: inputs.envId,
          runtime: 'Nodejs18.15',
          memorySize: 256,
          timeout: 15,
          installDependency: true,
          environment: { variables: envVars },
          clsLogsetId,
          clsTopicId,
        },
        topts
      )
      await waitUntilActive()
      await cloudAPI.scfUpdateFunction(
        {
          functionName: inputs.functionName,
          namespace: inputs.envId,
          region,
          handler: 'index.main',
          installDependency: true,
          fileData: zipBuffer.toString('base64'),
          codeSecret,
        },
        topts
      )
      await waitUntilActive()
    }

    return {
      appId: inputs.appId,
      envId: inputs.envId,
      functionName: inputs.functionName,
      miniappDir: inputs.miniappDir,
      distDir: inputs.distDir,
      codeHash: inputs.codeHash,
      fcBaseUrl: inputs.fcBaseUrl,
      proxySharedSecret: inputs.proxySharedSecret,
      filesCount,
      packSize: zipBuffer.byteLength,
    }
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true })
    if (tempKeyPath) {
      fs.rmSync(tempKeyPath, { force: true })
    }
  }
}

const wechatCloudFunctionProvider: pulumi.dynamic.ResourceProvider<
  WechatCloudFunctionInputs,
  WechatCloudFunctionOutputs
> = {
  async diff(_id, olds, news) {
    const replaces: string[] = []
    if (olds.appId !== news.appId) replaces.push('appId')
    if (olds.envId !== news.envId) replaces.push('envId')
    if (olds.functionName !== news.functionName) replaces.push('functionName')

    const changed =
      replaces.length > 0 ||
      olds.codeHash !== news.codeHash ||
      olds.fcBaseUrl !== news.fcBaseUrl ||
      olds.proxySharedSecret !== news.proxySharedSecret ||
      olds.miniappDir !== news.miniappDir ||
      olds.distDir !== news.distDir

    return {
      changes: changed,
      replaces,
    }
  },

  async create(inputs) {
    const outs = await deployViaMiniprogramCi(inputs)
    return {
      id: `${inputs.appId}:${inputs.envId}:${inputs.functionName}`,
      outs,
    }
  },

  async update(_id, _olds, news) {
    const outs = await deployViaMiniprogramCi(news)
    return { outs }
  },
}

export class WechatCloudFunction extends pulumi.dynamic.Resource {
  public readonly appId!: pulumi.Output<string>
  public readonly envId!: pulumi.Output<string>
  public readonly functionName!: pulumi.Output<string>
  public readonly fcBaseUrl!: pulumi.Output<string>
  public readonly filesCount!: pulumi.Output<number>
  public readonly packSize!: pulumi.Output<number>

  constructor(
    name: string,
    args: WechatCloudFunctionArgs,
    opts?: pulumi.CustomResourceOptions
  ) {
    super(
      wechatCloudFunctionProvider,
      name,
      {
        ...args,
        filesCount: undefined,
        packSize: undefined,
      },
      {
        ...opts,
        additionalSecretOutputs: [
          ...(opts?.additionalSecretOutputs ?? []),
          'privateKey',
          'proxySharedSecret',
        ],
      }
    )
  }
}
