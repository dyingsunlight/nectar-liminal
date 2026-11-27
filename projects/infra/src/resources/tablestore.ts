import * as alicloud from '@pulumi/alicloud'
import * as pulumi from '@pulumi/pulumi'
import type { InfraConfig } from '../config'

export interface TableStoreStack {
  instance: alicloud.ots.Instance
  endpoint: pulumi.Output<string>
  tables: {
    categories: alicloud.ots.Table
    products: alicloud.ots.Table
    banners: alicloud.ots.Table
    users: alicloud.ots.Table
  }
}

export function provisionTableStore(config: InfraConfig): TableStoreStack {
  const instance = new alicloud.ots.Instance('nectar-ots-instance', {
    name: config.otsInstanceName,
    description: 'Nectar Liminal TableStore instance managed by Pulumi',
    instanceType: config.otsInstanceType,
    accessedBy: 'Any',
    tags: {
      Project: 'nectar-liminal',
      ManagedBy: 'pulumi',
    },
  })

  const categories = new alicloud.ots.Table('nectar-ots-categories', {
    instanceName: instance.name,
    tableName: 'categories',
    primaryKeys: [{ name: 'id', type: 'String' }],
    timeToLive: -1,
    maxVersion: 1,
  })

  const products = new alicloud.ots.Table('nectar-ots-products', {
    instanceName: instance.name,
    tableName: 'products',
    primaryKeys: [{ name: 'id', type: 'String' }],
    timeToLive: -1,
    maxVersion: 1,
  })

  const banners = new alicloud.ots.Table('nectar-ots-banners', {
    instanceName: instance.name,
    tableName: 'banners',
    primaryKeys: [{ name: 'id', type: 'String' }],
    timeToLive: -1,
    maxVersion: 1,
  })

  const users = new alicloud.ots.Table('nectar-ots-users', {
    instanceName: instance.name,
    tableName: 'users',
    primaryKeys: [{ name: 'openId', type: 'String' }],
    timeToLive: -1,
    maxVersion: 1,
  })

  const endpoint = pulumi.interpolate`https://${instance.name}.${config.alicloudRegion}.ots.aliyuncs.com`

  return {
    instance,
    endpoint,
    tables: {
      categories,
      products,
      banners,
      users,
    },
  }
}
