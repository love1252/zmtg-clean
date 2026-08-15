import { sql } from 'drizzle-orm';

import {
  createBindingCommandId,
  executeBindingCommandWithUnitOfWork,
} from '@/modules/access-control/application/binding-command-service';
import type { MembershipCurrent } from '@/modules/access-control/domain/membership-lifecycle';
import { createMembershipCommandExternalTransactionAdapter } from '@/modules/access-control/server/membership-command-external-transaction';
import {
  createAuthoritativeInstitutionMembershipFactRepositoryV1,
  type CurrentInstitutionMembershipFactRow,
} from '@/modules/access-control/server/authoritative-membership-reader';
import {
  createMembershipCommandTransactionPort,
  createTransactionBoundMembershipCommandUnitOfWork,
  type MembershipCommandTransactionDatabase,
} from '@/modules/access-control/server/membership-command-repository';
import type { AuthAccountRecord } from '@/modules/auth/domain/auth-account';
import {
  createAuthAccountRepository,
  type AuthAccountRepository,
} from '@/modules/auth/server/auth-account-repository';
import {
  hashPasswordScrypt,
  verifyPasswordScrypt,
} from '@/modules/auth/server/password-hash';
import {
  computeProvisioningManifestDigest,
  PROVISIONING_MANIFEST_VERSION,
  type ProvisioningCanonicalManifestV1,
} from '@/modules/tenancy/provisioning/provisioning-canonicalization';
import {
  dryRunProvisioning,
  type ProvisioningAssessmentCountsV1,
} from '@/modules/tenancy/provisioning/provisioning-kernel';
import {
  parseProvisioningManifest,
  toProvisioningExpectedTriplet,
  type ProvisioningManifestV1,
} from '@/modules/tenancy/provisioning/provisioning-manifest';
import type {
  ProvisioningRepositoryV1,
  ProvisioningTransactionPortV1,
} from '@/modules/tenancy/provisioning/provisioning-ports';
import { createProvisioningReadonlyPostgresAdapter } from '@/modules/tenancy/provisioning/server/provisioning-readonly-postgres-adapter';
import { createProvisioningWritePostgresAdapter } from '@/modules/tenancy/provisioning/server/provisioning-write-postgres-adapter';
import { createTransactionBoundInstitutionScopeAssertion } from '@/modules/tenancy/server/transaction-bound-institution-scope';
import {
  CURRENT_DEMO_ADMIN_IDENTITY,
  CurrentDemoAdminPhaseExecutionError,
  classifyCurrentDemoAccount,
  classifyCurrentDemoBinding,
  classifyCurrentDemoMembership,
  classifyCurrentDemoProvisioning,
  decideCurrentDemoPhaseA,
  orchestrateCurrentDemoAdminFormalization,
  type CurrentDemoAdminAuthorityManifest,
  type CurrentDemoAdminFormalizationMode,
  type CurrentDemoAdminFormalizationPhasePorts,
  type CurrentDemoAdminFormalizationResult,
  type CurrentDemoPhaseAOutcome,
  type CurrentDemoPhaseBOutcome,
  type CurrentDemoPhaseCOutcome,
} from '@/server/orchestration/current-demo-admin-formalization';
import {
  createDatabase,
  createPostgresClient,
  type TenantDatabase,
} from '@/server/db/client';

const PHASE_A_TRANSACTION_OPTIONS = Object.freeze({
  isolationLevel: 'serializable' as const,
  accessMode: 'read write' as const,
});
const READONLY_TRANSACTION_OPTIONS = Object.freeze({
  isolationLevel: 'repeatable read' as const,
  accessMode: 'read only' as const,
});

type PostgresClient = ReturnType<typeof createPostgresClient>;

function phaseAConflict(
  accountState: CurrentDemoPhaseAOutcome['accountState'],
  membershipState: CurrentDemoPhaseAOutcome['membershipState'],
): CurrentDemoPhaseAOutcome {
  return Object.freeze({
    phase: 'conflict',
    accountState:
      accountState === 'conflict' ? 'conflict' : accountState,
    membershipState:
      membershipState === 'conflict' ? 'conflict' : membershipState,
    databaseWriteExecuted: false,
  });
}

function phaseBFromCounts(
  counts: ProvisioningAssessmentCountsV1,
): CurrentDemoPhaseBOutcome {
  const state = classifyCurrentDemoProvisioning(counts);
  if (state === 'missing') {
    return Object.freeze({
      phase: 'candidate',
      scopeState: 'missing',
      contextState: 'missing',
      databaseWriteExecuted: false,
    });
  }
  if (state === 'reused') {
    return Object.freeze({
      phase: 'reused',
      scopeState: 'reused',
      contextState: 'reused',
      databaseWriteExecuted: false,
    });
  }
  return Object.freeze({
    phase: state,
    scopeState: state,
    contextState: state,
    databaseWriteExecuted: false,
  });
}

function asMembershipSnapshot(value: MembershipCurrent | null) {
  if (value === null) return null;
  return Object.freeze({
    membershipId: value.membershipId,
    tenantId: value.tenantId,
    userId: value.userId,
    role: value.role,
    displayName: value.displayName,
    revision: value.revision,
    lifecycleStatus: value.lifecycleStatus,
    provenanceSource: value.provenanceSource,
    provenanceActorId: value.provenanceActorId,
    provenanceReasonCode: value.provenanceReasonCode,
  });
}

function asReadonlyMembershipSnapshot(
  value: CurrentInstitutionMembershipFactRow | null,
) {
  if (value === null) return null;
  return Object.freeze({
    membershipId: value.membershipId,
    tenantId: value.membershipTenantId,
    userId: value.membershipUserId,
    role: value.membershipRole,
    displayName: value.membershipDisplayName,
    revision: value.membershipRevision,
    lifecycleStatus: value.membershipLifecycleStatus,
    provenanceSource: value.membershipProvenanceSource,
    provenanceActorId: value.membershipProvenanceActorId,
    provenanceReasonCode: value.membershipProvenanceReasonCode,
  });
}

function asReadonlyBindingSnapshot(
  value: CurrentInstitutionMembershipFactRow | null,
) {
  if (value === null) return null;
  const bindingValues = [
    value.bindingId,
    value.bindingAccountId,
    value.bindingTenantId,
    value.bindingInstitutionId,
    value.bindingStatus,
    value.bindingSource,
    value.bindingAssignedAt,
    value.bindingExpiresAt,
    value.bindingRevokedAt,
    value.bindingVersion,
  ];
  if (value.bindingId === null) {
    if (bindingValues.some((entry) => entry !== null)) {
      throw new Error('current_demo_readonly_binding_incomplete');
    }
    return null;
  }
  if (
    value.bindingAccountId === null ||
    value.bindingTenantId === null ||
    value.bindingInstitutionId === null ||
    value.bindingStatus === null ||
    value.bindingSource === null ||
    value.bindingAssignedAt === null ||
    value.bindingRevokedAt !== null ||
    value.bindingVersion === null
  ) {
    throw new Error('current_demo_readonly_binding_incomplete');
  }
  return Object.freeze({
    bindingId: value.bindingId,
    accountId: value.bindingAccountId,
    tenantId: value.bindingTenantId,
    institutionId: value.bindingInstitutionId,
    status: value.bindingStatus,
    source: value.bindingSource,
    expiresAt: value.bindingExpiresAt?.toISOString() ?? null,
    version: value.bindingVersion,
  });
}

async function setPhaseATransactionLimits(
  transaction: TenantDatabase,
): Promise<void> {
  await transaction.execute(sql`SET LOCAL statement_timeout = '5000ms'`);
  await transaction.execute(sql`SET LOCAL lock_timeout = '1000ms'`);
  await transaction.execute(sql`
    SET LOCAL idle_in_transaction_session_timeout = '5000ms'
  `);
}

function createFormalAccountRecord(
  passwordHash: string,
  now: Date,
): AuthAccountRecord {
  const identity = CURRENT_DEMO_ADMIN_IDENTITY;
  return {
    id: identity.accountId,
    username: identity.username,
    displayName: identity.accountDisplayName,
    phone: null,
    email: null,
    passwordHash,
    passwordUpdatedAt: now,
    passwordResetRequired: false,
    status: 'active',
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdBy: identity.accountId,
    updatedBy: identity.accountId,
    createdAt: now,
    updatedAt: now,
  };
}

function buildCanonicalProvisioningManifest(
  authority: CurrentDemoAdminAuthorityManifest,
): ProvisioningManifestV1 {
  const canonical: ProvisioningCanonicalManifestV1 = {
    manifestVersion: PROVISIONING_MANIFEST_VERSION,
    approvalStatus: 'approved',
    approvedByReference: authority.authorityRef,
    approvedAt: authority.approvedAt,
    entries: [{
      tenantId: authority.tenantId,
      institutionId: authority.institutionId,
      scopeStatus: 'active',
      scopeRevision: 1,
      provisioningSource: 'approved_migration_manifest',
      contextVersion: 1,
      contextHeadRevision: 1,
      latestVersion: 1,
      contextSource: 'institution_config',
      timezone: authority.timezone,
      currency: authority.currency,
      effectiveFromBusinessDate: authority.effectiveFromBusinessDate,
      effectiveAt: authority.effectiveAt,
    }],
  };
  const digest = computeProvisioningManifestDigest(canonical);
  return parseProvisioningManifest({
    ...canonical,
    digest: digest.external,
  }, {
    contextPolicy: {
      timezones: [authority.timezone],
      currencies: [authority.currency],
    },
  });
}

function repositoryTransactionPort(
  repository: ProvisioningRepositoryV1,
): ProvisioningTransactionPortV1 {
  return Object.freeze({
    read: async <T>(
      work: (value: ProvisioningRepositoryV1) => Promise<T>,
    ): Promise<T> => work(repository),
    write: async <T>(
      work: (value: ProvisioningRepositoryV1) => Promise<T>,
    ): Promise<T> => work(repository),
  });
}

async function insertMissingProvisioningTriplet(input: Readonly<{
  manifest: ProvisioningManifestV1;
  repository: ProvisioningRepositoryV1;
}>): Promise<void> {
  const transactionPort = repositoryTransactionPort(input.repository);
  const before = classifyCurrentDemoProvisioning(
    await dryRunProvisioning(input.manifest, transactionPort),
  );
  if (before !== 'missing') {
    throw new Error('current_demo_provisioning_prestate_changed');
  }
  const entry = input.manifest.entries[0];
  if (!entry) throw new Error('current_demo_provisioning_entry_missing');
  const expected = toProvisioningExpectedTriplet(input.manifest, entry);
  const affected = [
    await input.repository.insertScope(expected.scope),
    await input.repository.insertContextVersion(expected.version),
    await input.repository.insertContextHead(expected.head),
  ];
  if (affected.some((count) => count !== 1)) {
    throw new Error('current_demo_provisioning_write_count_invalid');
  }
  const after = classifyCurrentDemoProvisioning(
    await dryRunProvisioning(input.manifest, transactionPort),
  );
  if (after !== 'reused') {
    throw new Error('current_demo_provisioning_recheck_failed');
  }
}

async function runPhaseADryRun(
  database: TenantDatabase,
  input: Readonly<{
    manifest: CurrentDemoAdminAuthorityManifest;
  }>,
): Promise<CurrentDemoPhaseAOutcome> {
  return database.transaction(async (transactionDatabase) => {
    const transaction = transactionDatabase as unknown as TenantDatabase;
    const accountRepository = createAuthAccountRepository(transaction);
    const membershipRepository =
      createAuthoritativeInstitutionMembershipFactRepositoryV1(transaction);
    const [account, rows] = await Promise.all([
      accountRepository.findAccountByUsername(input.manifest.username),
      membershipRepository.findCurrentInstitutionMembershipFacts({
        accountId: input.manifest.accountId,
        tenantId: input.manifest.tenantId,
        institutionId: input.manifest.institutionId,
      }),
    ]);
    const accountState = classifyCurrentDemoAccount(account);
    const membershipState = rows.length > 1
      ? 'conflict'
      : classifyCurrentDemoMembership(
        asReadonlyMembershipSnapshot(rows[0] ?? null),
        input.manifest,
      );
    const decision = decideCurrentDemoPhaseA({
      mode: 'dry-run',
      accountState,
      membershipState,
    });
    if (decision === 'conflict') {
      return phaseAConflict(
        accountState,
        accountState === 'missing' && membershipState === 'reused'
          ? 'conflict'
          : membershipState,
      );
    }
    return Object.freeze({
      phase: decision,
      accountState,
      membershipState,
      databaseWriteExecuted: false,
    });
  }, READONLY_TRANSACTION_OPTIONS);
}

async function runPhaseAExecute(
  database: TenantDatabase,
  input: Readonly<{
    manifest: CurrentDemoAdminAuthorityManifest;
    password: string | null;
    now: Date;
  }>,
): Promise<CurrentDemoPhaseAOutcome> {
  let writeAttempted = false;
  try {
    return await database.transaction(async (transactionDatabase) => {
      const transaction = transactionDatabase as unknown as TenantDatabase;
      await setPhaseATransactionLimits(transaction);
      let active = true;
      try {
        const repository: AuthAccountRepository =
          createAuthAccountRepository(transaction);
        const unitOfWork = createTransactionBoundMembershipCommandUnitOfWork(
          transaction as unknown as MembershipCommandTransactionDatabase,
          () => active,
        );
        const account = await repository.findAccountByUsername(
          input.manifest.username,
        );
        const membership = await unitOfWork.lockMembershipByTenantUser({
          tenantId: input.manifest.tenantId,
          userId: input.manifest.accountId,
        });
        const accountState = classifyCurrentDemoAccount(account);
        const membershipState = classifyCurrentDemoMembership(
          asMembershipSnapshot(membership),
          input.manifest,
        );
        const passwordVerified = accountState === 'reused'
          ? input.password !== null &&
            await verifyPasswordScrypt(input.password, account!.passwordHash)
          : undefined;
        const decision = decideCurrentDemoPhaseA({
          mode: 'execute',
          accountState,
          membershipState,
          passwordVerified,
        });
        if (decision === 'conflict') {
          return phaseAConflict(
            accountState === 'conflict' ||
                (accountState === 'reused' && passwordVerified === false)
              ? 'conflict'
              : accountState,
            accountState === 'missing' && membershipState === 'reused'
              ? 'conflict'
              : membershipState,
          );
        }
        if (decision === 'reused') {
          return Object.freeze({
            phase: 'reused',
            accountState: 'reused',
            membershipState: 'reused',
            databaseWriteExecuted: false,
          });
        }
        if (input.password === null) {
          throw new Error('current_demo_admin_password_unavailable');
        }

        const membershipAdapter =
          createMembershipCommandExternalTransactionAdapter();
        let accountWritten = false;
        let membershipWritten = false;
        if (accountState === 'missing') {
          const passwordHash = await hashPasswordScrypt(input.password);
          writeAttempted = true;
          await repository.createAccount(
            createFormalAccountRecord(passwordHash, input.now),
          );
          accountWritten = true;
        }
        if (membershipState === 'missing') {
          writeAttempted = true;
          await membershipAdapter.run(transaction, async (commands) => {
            await commands.createMembership({
              membershipId: input.manifest.membershipId,
              tenantId: input.manifest.tenantId,
              userId: input.manifest.accountId,
              role: 'tenant_admin',
              displayName: input.manifest.accountDisplayName,
              actorId: input.manifest.accountId,
              occurredAt: input.now.toISOString(),
            });
          });
          membershipWritten = true;
        }

        const accountAfter = await repository.findAccountByUsername(
          input.manifest.username,
        );
        const membershipAfter = await unitOfWork.lockMembershipByTenantUser({
          tenantId: input.manifest.tenantId,
          userId: input.manifest.accountId,
        });
        if (
          classifyCurrentDemoAccount(accountAfter) !== 'reused' ||
          classifyCurrentDemoMembership(
            asMembershipSnapshot(membershipAfter),
            input.manifest,
          ) !== 'reused'
        ) {
          throw new Error('current_demo_phase_a_recheck_failed');
        }
        return Object.freeze({
          phase: 'applied',
          accountState: accountWritten ? 'applied' : 'reused',
          membershipState: membershipWritten ? 'applied' : 'reused',
          databaseWriteExecuted: accountWritten || membershipWritten,
        });
      } finally {
        active = false;
      }
    }, PHASE_A_TRANSACTION_OPTIONS);
  } catch {
    throw new CurrentDemoAdminPhaseExecutionError(
      'phase_a',
      writeAttempted,
    );
  }
}

function createPhaseAPort(database: TenantDatabase) {
  return async (input: Readonly<{
    mode: CurrentDemoAdminFormalizationMode;
    manifest: CurrentDemoAdminAuthorityManifest;
    password: string | null;
    now: Date;
  }>): Promise<CurrentDemoPhaseAOutcome> => input.mode === 'dry-run'
    ? runPhaseADryRun(database, input)
    : runPhaseAExecute(database, input);
}

function createPhaseBPort(client: PostgresClient) {
  const readonlyAdapter = createProvisioningReadonlyPostgresAdapter(client);
  return async (input: Readonly<{
    mode: CurrentDemoAdminFormalizationMode;
    manifest: CurrentDemoAdminAuthorityManifest;
  }>): Promise<CurrentDemoPhaseBOutcome> => {
    const manifest = buildCanonicalProvisioningManifest(input.manifest);
    const before = phaseBFromCounts(
      await dryRunProvisioning(manifest, readonlyAdapter),
    );
    if (
      input.mode === 'dry-run' ||
      before.phase === 'reused' ||
      before.phase === 'conflict' ||
      before.phase === 'unexpected'
    ) {
      return before;
    }

    let writeAttempted = false;
    try {
      const writeAdapter = createProvisioningWritePostgresAdapter(client);
      writeAttempted = true;
      await writeAdapter.write((repository) =>
        insertMissingProvisioningTriplet({ manifest, repository }),
      );
      const after = classifyCurrentDemoProvisioning(
        await dryRunProvisioning(manifest, readonlyAdapter),
      );
      if (after !== 'reused') {
        throw new Error('current_demo_phase_b_post_commit_recheck_failed');
      }
      return Object.freeze({
        phase: 'applied',
        scopeState: 'applied',
        contextState: 'applied',
        databaseWriteExecuted: true,
      });
    } catch {
      throw new CurrentDemoAdminPhaseExecutionError(
        'phase_b',
        writeAttempted,
      );
    }
  };
}

function phaseCConflict(): CurrentDemoPhaseCOutcome {
  return Object.freeze({
    phase: 'conflict',
    bindingState: 'conflict',
    databaseWriteExecuted: false,
  });
}

async function runPhaseCDryRun(
  database: TenantDatabase,
  input: Readonly<{
    manifest: CurrentDemoAdminAuthorityManifest;
    phaseA: CurrentDemoPhaseAOutcome;
  }>,
): Promise<CurrentDemoPhaseCOutcome> {
  return database.transaction(async (transactionDatabase) => {
    const transaction = transactionDatabase as unknown as TenantDatabase;
    const repository =
      createAuthoritativeInstitutionMembershipFactRepositoryV1(transaction);
    const findSingle = repository.findSingleInstitutionMembershipFacts;
    if (!findSingle) throw new Error('current_demo_readonly_owner_unavailable');
    const rows = await findSingle({ accountId: input.manifest.accountId });
    if (rows.length > 1) return phaseCConflict();
    const row = rows[0] ?? null;
    const targetMembership = row !== null &&
        row.membershipId === input.manifest.membershipId &&
        row.membershipTenantId === input.manifest.tenantId &&
        row.membershipUserId === input.manifest.accountId
      ? row
      : null;
    if (row !== null && targetMembership === null) return phaseCConflict();
    const membershipState = classifyCurrentDemoMembership(
      asReadonlyMembershipSnapshot(targetMembership),
      input.manifest,
    );
    const bindingState = classifyCurrentDemoBinding(
      asReadonlyBindingSnapshot(targetMembership),
      input.manifest,
    );
    if (bindingState === 'conflict') return phaseCConflict();
    if (bindingState === 'reused') {
      return membershipState === 'reused'
        ? Object.freeze({
          phase: 'reused',
          bindingState: 'reused',
          databaseWriteExecuted: false,
        })
        : phaseCConflict();
    }
    const anticipatedMembership =
      input.phaseA.phase === 'candidate' && membershipState === 'missing';
    if (membershipState !== 'reused' && !anticipatedMembership) {
      return phaseCConflict();
    }
    return Object.freeze({
      phase: 'candidate',
      bindingState: 'missing',
      databaseWriteExecuted: false,
    });
  }, READONLY_TRANSACTION_OPTIONS);
}

async function runPhaseCExecute(
  database: TenantDatabase,
  input: Readonly<{
    manifest: CurrentDemoAdminAuthorityManifest;
    now: Date;
  }>,
): Promise<CurrentDemoPhaseCOutcome> {
  let writeAttempted = false;
  try {
    const transactionPort = createMembershipCommandTransactionPort(database, {
      createScopeAssertion: (transaction, isActive) =>
        createTransactionBoundInstitutionScopeAssertion(transaction, isActive),
    });
    return await transactionPort.run(async (unitOfWork, scopeAssertion) => {
      const membership = await unitOfWork.lockMembershipById({
        tenantId: input.manifest.tenantId,
        membershipId: input.manifest.membershipId,
      });
      const membershipState = classifyCurrentDemoMembership(
        asMembershipSnapshot(membership),
        input.manifest,
      );
      const activeBinding = await unitOfWork.lockActiveBinding({
        tenantId: input.manifest.tenantId,
        accountId: input.manifest.accountId,
      });
      const bindingState = classifyCurrentDemoBinding(
        activeBinding === null ? null : Object.freeze({
          bindingId: activeBinding.bindingId,
          accountId: activeBinding.accountId,
          tenantId: activeBinding.tenantId,
          institutionId: activeBinding.institutionId,
          status: 'active',
          source: activeBinding.source,
          expiresAt: activeBinding.expiresAt,
          version: activeBinding.version,
        }),
        input.manifest,
      );

      if (bindingState === 'conflict') return phaseCConflict();
      if (bindingState === 'reused') {
        return membershipState === 'reused'
          ? Object.freeze({
            phase: 'reused',
            bindingState: 'reused',
            databaseWriteExecuted: false,
          })
          : phaseCConflict();
      }

      const priorTargetBinding = await unitOfWork.lockBindingById({
        tenantId: input.manifest.tenantId,
        bindingId: input.manifest.bindingId,
      });
      if (priorTargetBinding !== null || membershipState !== 'reused' ||
          membership?.revision !== 1) {
        return phaseCConflict();
      }

      writeAttempted = true;
      const result = await executeBindingCommandWithUnitOfWork({
        unitOfWork,
        scopeAssertion,
        command: Object.freeze({
          kind: 'create' as const,
          commandId: createBindingCommandId(),
          accountId: input.manifest.accountId,
          tenantId: input.manifest.tenantId,
          membershipId: input.manifest.membershipId,
          expectedMembershipRevision: membership.revision,
          bindingId: input.manifest.bindingId,
          institutionId: input.manifest.institutionId,
          assignmentSource: input.manifest.assignmentSource,
          provenanceSource: input.manifest.provenanceSource,
          actorId: input.manifest.accountId,
          reasonCode: input.manifest.reasonCode,
          occurredAt: input.now.toISOString(),
          expiresAt: null,
        }),
        now: () => input.now,
      });
      if (result.status === 'blocked') {
        const unexpected = result.code === 'binding_scope_unavailable' ||
          result.code === 'membership_command_repository_unavailable' ||
          result.code === 'membership_command_timeout';
        return Object.freeze({
          phase: unexpected ? 'unexpected' : 'conflict',
          bindingState: unexpected ? 'unexpected' : 'conflict',
          databaseWriteExecuted: false,
        });
      }
      if (
        result.bindingId !== input.manifest.bindingId ||
        result.bindingStatus !== 'active' ||
        result.bindingVersion !== 1 ||
        result.membershipRevision !== membership.revision
      ) {
        throw new Error('current_demo_phase_c_result_invalid');
      }
      return Object.freeze({
        phase: 'applied',
        bindingState: 'applied',
        databaseWriteExecuted: true,
      });
    });
  } catch {
    throw new CurrentDemoAdminPhaseExecutionError(
      'phase_c',
      writeAttempted,
    );
  }
}

function createPhaseCPort(database: TenantDatabase) {
  return async (input: Readonly<{
    mode: CurrentDemoAdminFormalizationMode;
    manifest: CurrentDemoAdminAuthorityManifest;
    phaseA: CurrentDemoPhaseAOutcome;
    now: Date;
  }>): Promise<CurrentDemoPhaseCOutcome> => input.mode === 'dry-run'
    ? runPhaseCDryRun(database, input)
    : runPhaseCExecute(database, input);
}

export function createCurrentDemoAdminFormalizationPhasePorts(input: Readonly<{
  database: TenantDatabase;
  postgresClient: PostgresClient;
}>): CurrentDemoAdminFormalizationPhasePorts {
  return Object.freeze({
    runPhaseA: createPhaseAPort(input.database),
    runPhaseB: createPhaseBPort(input.postgresClient),
    runPhaseC: createPhaseCPort(input.database),
  });
}

export async function executeCurrentDemoAdminFormalization(input: Readonly<{
  mode: CurrentDemoAdminFormalizationMode;
  manifest: CurrentDemoAdminAuthorityManifest;
  password: string | null;
  now: Date;
  phases: CurrentDemoAdminFormalizationPhasePorts;
}>): Promise<CurrentDemoAdminFormalizationResult> {
  return orchestrateCurrentDemoAdminFormalization(input);
}

/** Runner 唯一的 production composition 入口。 */
export async function runCurrentDemoAdminFormalization(input: Readonly<{
  mode: CurrentDemoAdminFormalizationMode;
  manifest: CurrentDemoAdminAuthorityManifest;
  password: string | null;
  databaseUrl: string;
  now: Date;
}>, dependencies: Readonly<{
  createPostgresClient: typeof createPostgresClient;
  createDatabase: typeof createDatabase;
  createPhasePorts: typeof createCurrentDemoAdminFormalizationPhasePorts;
  execute: typeof executeCurrentDemoAdminFormalization;
}> = {
  createPostgresClient,
  createDatabase,
  createPhasePorts: createCurrentDemoAdminFormalizationPhasePorts,
  execute: executeCurrentDemoAdminFormalization,
}): Promise<CurrentDemoAdminFormalizationResult> {
  const postgresClient = dependencies.createPostgresClient(input.databaseUrl);
  try {
    const database = dependencies.createDatabase(postgresClient);
    return await dependencies.execute({
      mode: input.mode,
      manifest: input.manifest,
      password: input.password,
      now: input.now,
      phases: dependencies.createPhasePorts({
        database,
        postgresClient,
      }),
    });
  } finally {
    try {
      await postgresClient.end({ timeout: 5 });
    } catch {
      // 资源清理失败不能覆盖已经确定的数据库语义结果或原始异常。
    }
  }
}
