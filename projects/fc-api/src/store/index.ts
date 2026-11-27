import { MemoryRepository } from './memory'
import type { Repository } from './repository'
import { TableStoreRepository } from './tablestore'

const memorySingleton = new MemoryRepository()
const tableStoreSingleton = new TableStoreRepository()

export function getRepository(): Repository {
  if (process.env.OTS_ENDPOINT && process.env.OTS_INSTANCE_NAME) {
    return tableStoreSingleton
  }
  return memorySingleton
}

export type { Repository, SeedResult } from './repository'
export { updateRuntimeStsCredentials, type FcStsCredentials } from './tablestore'
