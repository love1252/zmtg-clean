import type {
  BindingCurrent,
  BindingTransitionEvidence,
} from '@/modules/access-control/domain/binding-lifecycle';
import type {
  CompleteMembershipCurrent,
  MembershipCurrent,
  MembershipLifecycleStatus,
  MembershipTransition,
} from '@/modules/access-control/domain/membership-lifecycle';
import type { TransactionBoundInstitutionScopeAssertion } from '@/modules/tenancy/ports/transaction-bound-institution-scope';

export const MEMBERSHIP_COMMAND_PERSISTENCE_ERROR_CODES = [
  'command_replay_rejected',
  'membership_create_conflict',
  'membership_cas_conflict',
  'binding_conflict',
  'binding_cas_conflict',
  'binding_evidence_conflict',
  'membership_command_constraint_conflict',
  'membership_command_concurrency_conflict',
  'membership_command_timeout',
  'membership_command_affected_rows_invalid',
  'membership_command_repository_unavailable',
] as const;

export type MembershipCommandPersistenceErrorCode =
  (typeof MEMBERSHIP_COMMAND_PERSISTENCE_ERROR_CODES)[number];

export class MembershipCommandPersistenceError extends Error {
  constructor(readonly code: MembershipCommandPersistenceErrorCode) {
    super(code);
    this.name = 'MembershipCommandPersistenceError';
  }
}

export interface ActiveMembershipBinding {
  readonly bindingId: string;
  readonly accountId: string;
  readonly tenantId: string;
  readonly institutionId: string;
  readonly source: 'manual_admin' | 'migration_placeholder' | 'system';
  readonly assignedBy: string;
  readonly assignedAt: string;
  readonly expiresAt: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InsertMembershipBindingRow {
  readonly bindingId: string;
  readonly accountId: string;
  readonly tenantId: string;
  readonly institutionId: string;
  readonly source: 'manual_admin' | 'system';
  readonly assignedBy: string;
  readonly assignedAt: string;
  readonly expiresAt: string | null;
  readonly recordedAt: string;
}

export interface MembershipCommandUnitOfWork {
  /** 仅在同一外层事务内锁定 create 自然键竞争窗口。 */
  lockCreateIdentity(input: Readonly<{
    tenantId: string;
    userId: string;
  }>): Promise<void>;
  /** 以 tenant/user 锁 current；仅 create 使用。 */
  lockMembershipByTenantUser(input: Readonly<{
    tenantId: string;
    userId: string;
  }>): Promise<MembershipCurrent | null>;
  /** 以 tenant/membership id 锁 current；非 create 命令使用。 */
  lockMembershipById(input: Readonly<{
    tenantId: string;
    membershipId: string;
  }>): Promise<MembershipCurrent | null>;
  /** current 之后锁定唯一 persisted active Binding。 */
  lockActiveBinding(input: Readonly<{
    tenantId: string;
    accountId: string;
  }>): Promise<ActiveMembershipBinding | null>;
  /** standalone Binding command 以 explicit identity 锁定 current row。 */
  lockBindingById(input: Readonly<{
    tenantId: string;
    bindingId: string;
  }>): Promise<BindingCurrent | null>;
  /** 同时覆盖 Membership 与 Binding transition command identity。 */
  commandExists(input: Readonly<{
    tenantId: string;
    commandId: string;
  }>): Promise<boolean>;
  insertMembership(current: CompleteMembershipCurrent): Promise<number>;
  updateMembershipByCas(input: Readonly<{
    previous: CompleteMembershipCurrent;
    next: CompleteMembershipCurrent;
    expectedRevision: number;
    expectedLifecycleStatus: MembershipLifecycleStatus;
  }>): Promise<number>;
  insertActiveBinding(row: InsertMembershipBindingRow): Promise<number>;
  revokeActiveBindingByCas(input: Readonly<{
    binding: ActiveMembershipBinding;
    revokedAt: string;
    recordedAt: string;
  }>): Promise<number>;
  appendBindingTransition(
    transition: BindingTransitionEvidence,
  ): Promise<number>;
  appendTransition(transition: MembershipTransition): Promise<number>;
}
export interface MembershipCommandTransactionPort {
  /**
   * 精确开启一个 SERIALIZABLE、READ WRITE 外层事务并注入 transaction-bound
   * UoW 与可选 Scope assertion。回调抛错必须整批回滚；实现禁止自动重试，
   * UoW 与 Scope assertion 在回调结束后失效。
   */
  run<T>(
    work: (
      unitOfWork: MembershipCommandUnitOfWork,
      scopeAssertion?: TransactionBoundInstitutionScopeAssertion,
    ) => Promise<T>,
  ): Promise<T>;
}
