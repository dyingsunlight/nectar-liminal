import * as path from 'node:path'
import * as cloudflare from '@pulumi/cloudflare'
import * as command from '@pulumi/command'
import * as pulumi from '@pulumi/pulumi'
import type { InfraConfig } from '../config'
import { hashPaths } from '../utils/hash'

export interface CloudflareAdminStack {
  pagesProject: cloudflare.PagesProject
  deployCommand: command.local.Command
  url: pulumi.Output<string>
}

export interface ProvisionCloudflareArgs {
  config: InfraConfig
  workspaceRoot: string
  fcHttpUrl: pulumi.Output<string>
}

export function provisionCloudflareAdmin(
  args: ProvisionCloudflareArgs
): CloudflareAdminStack {
  const { config, workspaceRoot, fcHttpUrl } = args

  if (!config.cloudflareAccountId) {
    throw new Error('cloudflareAccountId is required when enableCloudflare=true')
  }

  const adminDir = path.join(workspaceRoot, 'projects', 'admin')
  const sharedDir = path.join(workspaceRoot, 'projects', 'shared')

  const pagesProject = new cloudflare.PagesProject('nectar-admin-pages', {
    accountId: config.cloudflareAccountId,
    name: config.cloudflarePagesProjectName,
    productionBranch: 'main',
  })

  const adminHash = hashPaths([
    path.join(adminDir, 'src'),
    path.join(adminDir, 'public'),
    path.join(adminDir, 'index.html'),
    path.join(adminDir, 'package.json'),
    path.join(sharedDir, 'src'),
  ])

  const environment: Record<string, pulumi.Input<string>> = {
    VITE_API_BASE_URL: fcHttpUrl,
    CLOUDFLARE_ACCOUNT_ID: config.cloudflareAccountId,
  }

  if (config.cloudflareApiToken) {
    environment.CLOUDFLARE_API_TOKEN = config.cloudflareApiToken
  } else if (process.env.CLOUDFLARE_API_TOKEN) {
    environment.CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
  }

  const deployCommand = new command.local.Command(
    'deploy-admin-pages',
    {
      dir: adminDir,
      create: pulumi.interpolate`pnpm --filter @nectar/admin build && npx --yes wrangler pages deploy dist --project-name=${pagesProject.name} --branch=main --commit-dirty=true`,
      environment,
      triggers: [fcHttpUrl, adminHash, pagesProject.name],
    },
    {
      dependsOn: [pagesProject],
    }
  )

  return {
    pagesProject,
    deployCommand,
    url: pulumi.interpolate`https://${pagesProject.subdomain}`,
  }
}
