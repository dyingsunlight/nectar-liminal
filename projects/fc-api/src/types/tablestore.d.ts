declare module 'tablestore' {
  export interface PrimaryKeyColumn {
    [columnName: string]: string | number | LongValue | symbol
  }

  export type PrimaryKey = PrimaryKeyColumn[]

  export interface AttributeColumn {
    [columnName: string]: string | number | boolean | Buffer | LongValue
  }

  export interface LongValue {
    toNumber(): number
    toString(): string
  }

  export interface TableStoreRow {
    primaryKey?: Array<{ name: string; value: string | number | LongValue }>
    attributes?: Array<{ columnName: string; columnValue: string | number | boolean | Buffer | LongValue }>
  }

  export interface ClientOptions {
    accessKeyId: string
    secretAccessKey: string
    endpoint: string
    instancename: string
    stsToken?: string
    securityToken?: string
    maxRetries?: number
  }

  export interface GetRowParams {
    tableName: string
    primaryKey: PrimaryKey
    columnsToGet?: string[]
  }

  export interface GetRowResult {
    row?: TableStoreRow
  }

  export interface PutRowParams {
    tableName: string
    condition: ConditionInstance
    primaryKey: PrimaryKey
    attributeColumns: AttributeColumn[]
  }

  export interface DeleteRowParams {
    tableName: string
    condition: ConditionInstance
    primaryKey: PrimaryKey
  }

  export interface GetRangeParams {
    tableName: string
    direction: string
    inclusiveStartPrimaryKey: PrimaryKey
    exclusiveEndPrimaryKey: PrimaryKey
    limit?: number
    columnsToGet?: string[]
  }

  export interface GetRangeResult {
    rows?: TableStoreRow[]
    next_start_primary_key?: PrimaryKey | null
  }

  export class ConditionInstance {}

  export class Client {
    constructor(options: ClientOptions)
    getRow(params: GetRowParams, callback: (err: Error | null, data: GetRowResult) => void): void
    putRow(params: PutRowParams, callback: (err: Error | null, data: unknown) => void): void
    deleteRow(params: DeleteRowParams, callback: (err: Error | null, data: unknown) => void): void
    getRange(params: GetRangeParams, callback: (err: Error | null, data: GetRangeResult) => void): void
  }

  export class Condition {
    constructor(rowExistence: number, columnCondition: unknown)
  }

  export const Long: {
    fromNumber(value: number): LongValue
  }

  export const RowExistenceExpectation: {
    IGNORE: number
    EXPECT_EXIST: number
    EXPECT_NOT_EXIST: number
  }

  export const Direction: {
    FORWARD: string
    BACKWARD: string
  }

  export const INF_MIN: symbol
  export const INF_MAX: symbol
}
