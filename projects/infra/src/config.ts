import * as pulumi from '@pulumi/pulumi'

export interface InfraConfig {
  alicloudRegion: string
  otsInstanceName: string
  otsInstanceType: 'Capacity' | 'HighPerformance'
  fcFunctionName: string
  fcRuntime: string
  wxAppId: string
  wxEnvId?: string
  wxFunctionName: string
  wxPrivateKey?: pulumi.Output<string>
  wxPrivateKeyPath?: string
  cloudflareAccountId?: string
  cloudflareApiToken?: pulumi.Output<string>
  cloudflarePagesProjectName: string
  corsExtraOrigins: string[]
  enableAliyun: boolean
  enableWechat: boolean
  enableCloudflare: boolean
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return defaultValue
  }
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

export function loadInfraConfig(): InfraConfig {
  const cfg = new pulumi.Config()
  const alicloudCfg = new pulumi.Config('alicloud')
  const cloudflareCfg = new pulumi.Config('cloudflare')

  const alicloudRegion = alicloudCfg.get('region') || 'cn-hangzhou'
  const otsInstanceName = cfg.get('otsInstanceName') || 'nectar-liminal'

  if (!/^[a-zA-Z][a-zA-Z0-9-]{2,15}$/.test(otsInstanceName)) {
    throw new Error(
      `Invalid otsInstanceName "${otsInstanceName}": must start with a letter, use [a-zA-Z0-9-], and be 3-16 characters long`
    )
  }

  const rawInstanceType = cfg.get('otsInstanceType') || 'Capacity'
  const otsInstanceType =
    rawInstanceType === 'HighPerformance' ? 'HighPerformance' : 'Capacity'

  const wxEnvId = cfg.get('wxEnvId') || process.env.WX_ENV_ID || undefined
  const cloudflareAccountId =
    cfg.get('cloudflareAccountId') || process.env.CLOUDFLARE_ACCOUNT_ID || undefined

  const enableAliyun = parseBool(cfg.get('enableAliyun'), true)
  const enableWechat = parseBool(cfg.get('enableWechat'), Boolean(wxEnvId))
  const enableCloudflare = parseBool(
    cfg.get('enableCloudflare'),
    Boolean(cloudflareAccountId)
  )

  const corsExtraOrigins = (cfg.get('corsExtraOrigins') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    alicloudRegion,
    otsInstanceName,
    otsInstanceType,
    fcFunctionName: cfg.get('fcFunctionName') || 'nectar-liminal-api',
    fcRuntime: cfg.get('fcRuntime') || 'nodejs20',
    wxAppId: cfg.get('wxAppId') || 'wxd4fffd6f357a8e76',
    wxEnvId,
    wxFunctionName: cfg.get('wxFunctionName') || 'apiProxy',
    wxPrivateKey: cfg.getSecret('wxPrivateKey'),
    wxPrivateKeyPath: cfg.get('wxPrivateKeyPath') || process.env.WX_PRIVATE_KEY_PATH,
    cloudflareAccountId,
    cloudflareApiToken: cloudflareCfg.getSecret('apiToken'),
    cloudflarePagesProjectName:
      cfg.get('cloudflarePagesProjectName') || 'nectar-liminal-admin',
    corsExtraOrigins,
    enableAliyun,
    enableWechat,
    enableCloudflare,
  }
}
