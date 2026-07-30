import type {
  ProvisioningContextSourceV1,
  ProvisioningScopeStatusV1,
  ProvisioningSourceV1,
} from './provisioning-canonicalization';

export interface ProvisioningScopeRowV1 {
  readonly tenantId: string;
  readonly institutionId: string;
  readonly status: ProvisioningScopeStatusV1;
  readonly revision: number;
  readonly provisioningSource: ProvisioningSourceV1;
  readonly provisioningReferenceDigest: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
}

export interface ProvisioningContextVersionRowV1 {
  readonly tenantId: string;
  readonly institutionId: string;
  readonly version: number;
  readonly timezone: string;
  readonly currency: string;
  readonly effectiveFromBusinessDate: string;
  readonly effectiveAt: string;
  readonly source: ProvisioningContextSourceV1;
  readonly migrationProvenance: string | null;
  readonly createdBy: string;
}

export interface ProvisioningContextHeadRowV1 {
  readonly tenantId: string;
  readonly institutionId: string;
  readonly revision: number;
  readonly latestVersion: number;
  readonly updatedBy: string;
}

export interface ProvisioningExpectedTripletV1 {
  readonly scope: ProvisioningScopeRowV1;
  readonly version: ProvisioningContextVersionRowV1;
  readonly head: ProvisioningContextHeadRowV1;
}

export interface ProvisioningTripletSnapshotV1 {
  readonly scopes: readonly ProvisioningScopeRowV1[];
  readonly versions: readonly ProvisioningContextVersionRowV1[];
  readonly heads: readonly ProvisioningContextHeadRowV1[];
}

export interface ProvisioningRepositoryV1 {
  tenantExists(tenantId: string): Promise<boolean>;
  /**
   * 返回该 tenantId + institutionId 的完整 Scope、全部 Context Version
   * 与 Head 集合。未来 Adapter 不得只按目标 version 过滤；时间字段必须先
   * 规范化为 canonical ISO 字符串，自动 createdAt／updatedAt 可作为附加字段。
   */
  readTriplet(input: {
    readonly tenantId: string;
    readonly institutionId: string;
  }): Promise<ProvisioningTripletSnapshotV1>;
  /** 必须执行纯 INSERT 并返回精确 affected row count；当前契约只接受 1。 */
  insertScope(row: ProvisioningScopeRowV1): Promise<number>;
  /** 必须执行纯 INSERT 并返回精确 affected row count；当前契约只接受 1。 */
  insertContextVersion(
    row: ProvisioningContextVersionRowV1,
  ): Promise<number>;
  /** 必须执行纯 INSERT 并返回精确 affected row count；当前契约只接受 1。 */
  insertContextHead(row: ProvisioningContextHeadRowV1): Promise<number>;
}

export interface ProvisioningTransactionPortV1 {
  /**
   * 在一致只读视图内执行完整批次分类，不得产生任何数据库写入。
   */
  read<T>(
    work: (repository: ProvisioningRepositoryV1) => Promise<T>,
  ): Promise<T>;
  /**
   * 在单一原子事务内执行；回调抛出或任一写入失败时必须回滚全部变更。
   * Adapter 不得在回调之外补写、重试、upsert 或降级提交。
   *
   * 从首次完整批次分类到提交必须保持稳定数据库视图：实现必须使用
   * SERIALIZABLE 或等价的行锁、predicate／advisory lock，并覆盖“目标行尚不
   * 存在”的竞争窗口。并发漂移或 serialization failure 必须令回调失败并回滚，
   * 不得让 reusedCandidate 在提交时变成不一致事实。
   */
  write<T>(
    work: (repository: ProvisioningRepositoryV1) => Promise<T>,
  ): Promise<T>;
}
