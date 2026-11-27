import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as alicloud from '@pulumi/alicloud'
import * as pulumi from '@pulumi/pulumi'
import type { InfraConfig } from '../config'
import { hashPaths } from '../utils/hash'
import type { TableStoreStack } from './tablestore'

export interface FcApiStack {
  role: alicloud.ram.Role
  fn: alicloud.fc.V3Function
  trigger: alicloud.fc.V3Trigger
  httpUrl: pulumi.Output<string>
  intranetUrl: pulumi.Output<string>
}

export interface ProvisionFcArgs {
  config: InfraConfig
  workspaceRoot: string
  tablestore: TableStoreStack
  proxySharedSecret: pulumi.Output<string>
  adminApiToken: pulumi.Output<string>
}

function ensureFcZipBuilt(workspaceRoot: string, fcApiDir: string): string {
  const zipPath = path.join(fcApiDir, 'dist', 'fc-code.zip')
  if (!fs.existsSync(zipPath)) {
    execFileSync('pnpm', ['--filter', '@nectar/fc-api', 'build'], {
      cwd: workspaceRoot,
      stdio: 'inherit',
    })
  }
  return zipPath
}

export function provisionFcApi(args: ProvisionFcArgs): FcApiStack {
  const { config, workspaceRoot, tablestore, proxySharedSecret, adminApiToken } = args
  const fcApiDir = path.join(workspaceRoot, 'projects', 'fc-api')
  const sharedDir = path.join(workspaceRoot, 'projects', 'shared')

  const codeHash = hashPaths([
    path.join(fcApiDir, 'src'),
    path.join(fcApiDir, 'package.json'),
    path.join(fcApiDir, 'scripts'),
    path.join(sharedDir, 'src'),
  ])

  const zipPath = ensureFcZipBuilt(workspaceRoot, fcApiDir)
  const zipBase64 = fs.readFileSync(zipPath).toString('base64')

  const role = new alicloud.ram.Role('nectar-fc-exec-role', {
    roleName: `${config.fcFunctionName}-exec-role`,
    description: 'Execution role allowing FC 3.0 API to access Alibaba Cloud TableStore',
    force: true,
    assumeRolePolicyDocument: JSON.stringify({
      Version: '1',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: ['fc.aliyuncs.com'],
          },
        },
      ],
    }),
  })

  const otsPolicyAttachment = new alicloud.ram.RolePolicyAttachment(
    'nectar-fc-ots-policy',
    {
      policyName: 'AliyunOTSFullAccess',
      policyType: 'System',
      roleName: role.roleName,
    }
  )

  const allowedOrigins = [
    `https://${config.cloudflarePagesProjectName}.pages.dev`,
    `https://*.${config.cloudflarePagesProjectName}.pages.dev`,
    'http://localhost:5173',
    ...config.corsExtraOrigins,
  ].join(',')

  const fn = new alicloud.fc.V3Function(
    'nectar-fc-api-fn',
    {
      functionName: config.fcFunctionName,
      description: 'Nectar Liminal HTTP API backed by Hono and TableStore',
      runtime: config.fcRuntime,
      handler: 'index.handler',
      memorySize: 512,
      cpu: 0.5,
      diskSize: 512,
      timeout: 15,
      internetAccess: true,
      role: role.arn,
      code: {
        zipFile: zipBase64,
      },
      environmentVariables: {
        CODE_SHA256: codeHash,
        OTS_INSTANCE_NAME: tablestore.instance.name,
        OTS_ENDPOINT: tablestore.endpoint,
        OTS_TABLE_CATEGORIES: tablestore.tables.categories.tableName,
        OTS_TABLE_PRODUCTS: tablestore.tables.products.tableName,
        OTS_TABLE_BANNERS: tablestore.tables.banners.tableName,
        OTS_TABLE_USERS: tablestore.tables.users.tableName,
        CORS_ALLOW_ORIGINS: allowedOrigins,
        PROXY_SHARED_SECRET: proxySharedSecret,
        ADMIN_API_TOKEN: adminApiToken,
      },
    },
    {
      dependsOn: [otsPolicyAttachment],
      ignoreChanges: ['logConfig'],
    }
  )

  const trigger = new alicloud.fc.V3Trigger('nectar-fc-http-trigger', {
    functionName: fn.functionName,
    triggerName: 'http-default',
    triggerType: 'http',
    qualifier: 'LATEST',
    description: 'Public HTTP trigger for WeChat proxy and Cloudflare Pages CORS calls',
    triggerConfig: JSON.stringify({
      authType: 'anonymous',
      disableURLInternet: false,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  })

  return {
    role,
    fn,
    trigger,
    httpUrl: trigger.httpTrigger.urlInternet,
    intranetUrl: trigger.httpTrigger.urlIntranet,
  }
}
