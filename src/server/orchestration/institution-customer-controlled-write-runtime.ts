
import { randomUUID } from 'node:crypto';
import { isProxy } from 'node:util/types';

import { createAccessControlAuthoritativeMembershipFactReaderV1 } from '@/modules/access-control/application/authoritative-membership-reader';
import {
  createVerifiedInstitutionAttributedTenantAuditEventV1,
  type AuditReason,
} from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  createCustomerCommandService,
  type CustomerCommandRecord,
  type CustomerLifecycle,
  type CustomerPriority,
} from '@/modules/customers/application/customer-command-service';
import type { CustomerControlledDtoV1 } from '@/modules/customers/application/customer-controlled-view';
import {
  createCustomerCommandRepository,
  readScopedCustomerCommandRecordV1,
} from '@/modules/customers/server/customer-command-repository';
import type { CapabilityStatusV1 } from '@/modules/institution-contracts/v1/institution-capability';
import { isInstitutionRoleV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import {
  checkTenantQuotaForCreate,
  lockTenantCustomerCreateQuotaV1,
} from '@/modules/institution/server/tenant-quota-enforcement';
import { getDatabase, type TenantDatabase } from '@/server/db/client';
import { resolveInstitutionAuditWriterVerifiedAttributionV1 } from '@/server/orchestration/institution-audit-writer-scope';
import { resolveInstitutionCapabilityAuthorityStatusV1 } from '@/server/orchestration/institution-capability-authority';
import {
  consumeInstitutionCustomerWriteAuthorizationV1,
  resolveInstitutionCustomerWriteAuthorizationV1,
  type InstitutionCustomerWriteAuthorizationConsumptionV1,
} from '@/server/orchestration/institution-customer-write-authorization';

const stableIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const canonicalInstant =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const lifecycleValues = Object.freeze([
  'consulting',
  'scheduled',
  'post_care',
  'repurchase_window',
  'silent_reactivation',
] as const satisfies readonly CustomerLifecycle[]);

const priorityValues = Object.freeze([
  'high',
  'medium',
  'observe',
] as const satisfies readonly CustomerPriority[]);

const controlledFieldKeys = Object.freeze([
  'displayName',
  'lifecycle',
  'priority',
  'ownerUserId',
  'projectInterest',
] as const);

type ControlledFieldKey = (typeof controlledFieldKeys)[number];

type ControlledChanges = Partial<
  Pick<
    CustomerCommandRecord,
    ControlledFieldKey
  >
>;

export type CustomerControlledReadResultV1 =
  | Readonly<{
      kind: 'ready';
      record: CustomerControlledDtoV1;
    }>
  | Readonly<{
      kind: 'forbidden' | 'not_found' | 'unavailable';
    }>;

export type CustomerControlledMutationResultV1 =
  | Readonly<{
      kind: 'ready';
      record: CustomerControlledDtoV1;
    }>
  | Readonly<{
      kind:
        | 'invalid'
        | 'forbidden'
        | 'not_found'
        | 'conflict'
        | 'quota_denied'
        | 'unavailable';
      code?: string;
    }>;

type Authorization =
  | Readonly<{
      kind: 'allowed';
      actor: InstitutionCustomerWriteAuthorizationConsumptionV1;
    }>
  | Readonly<{ kind: 'forbidden' }>
  | Readonly<{ kind: 'unavailable' }>;

const AUTH_FORBIDDEN = Object.freeze({ kind: 'forbidden' as const });
const AUTH_UNAVAILABLE = Object.freeze({ kind: 'unavailable' as const });

function isManagement(
  role: InstitutionCustomerWriteAuthorizationConsumptionV1['role'],
): boolean {
  return role === 'tenant_admin' || role === 'tenant_operator';
}

function releasedCapability(
  status: CapabilityStatusV1 | null,
  key: 'page_customer_list' | 'action_customer_create',
): boolean {
  if (
    !status ||
    status.contractVersion !== 'v1' ||
    status.readiness !== 'ready' ||
    status.failureCode !== null ||
    !status.data
  ) {
    return false;
  }

  const capabilities = status.data.capabilities.filter((item) => item.key === key);
  const partitions = status.partitions.filter((item) => item.key === key);

  return (
    capabilities.length === 1 &&
    partitions.length === 1 &&
    capabilities[0]?.decision === 'operational' &&
    capabilities[0].dimensions.codeMaturity === 'verified' &&
    capabilities[0].dimensions.institutionAuthorization === 'authorized' &&
    capabilities[0].dimensions.connectionAvailability === 'not_required' &&
    capabilities[0].dimensions.dataReadiness === 'ready' &&
    capabilities[0].dimensions.productionRelease === 'pilot_released' &&
    (
      key === 'page_customer_list'
        ? capabilities[0].safeSummary === '客户列表可用'
        : capabilities[0].safeSummary === null
    ) &&
    partitions[0]?.readiness === 'ready' &&
    partitions[0].failureCode === null
  );
}

async function authorize(requireCreate: boolean): Promise<Authorization> {
  const resolution = await resolveInstitutionCustomerWriteAuthorizationV1();

  if (resolution.kind === 'forbidden') return AUTH_FORBIDDEN;
  if (resolution.kind !== 'allowed') return AUTH_UNAVAILABLE;

  const actor = consumeInstitutionCustomerWriteAuthorizationV1(
    resolution.authorization,
  );
  if (!actor) return AUTH_UNAVAILABLE;

  const status = await resolveInstitutionCapabilityAuthorityStatusV1();
  if (
    status?.scope.tenantId !== actor.tenantId ||
    status.scope.institutionId !== actor.institutionId ||
    !releasedCapability(status, 'page_customer_list')
  ) {
    return AUTH_UNAVAILABLE;
  }

  if (
    requireCreate &&
    !releasedCapability(status, 'action_customer_create')
  ) {
    return AUTH_UNAVAILABLE;
  }

  return Object.freeze({ kind: 'allowed' as const, actor });
}

function snapshot(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return null;
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).length !== keys.length ||
      keys.some((key) => !Object.hasOwn(descriptors, key))
    ) {
      return null;
    }

    const result: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
      Object.defineProperty(result, key, {
        value: descriptor.value,
        enumerable: true,
      });
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function readText(
  value: unknown,
  maxLength: number,
  allowEmpty: boolean,
): string | null {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    [...value].length > maxLength ||
    (!allowEmpty && value.length === 0) ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return null;
  }
  return value;
}

function readLifecycle(value: unknown): CustomerLifecycle | null {
  return (
    typeof value === 'string' &&
    lifecycleValues.some((item) => item === value)
  )
    ? (value as CustomerLifecycle)
    : null;
}

function readPriority(value: unknown): CustomerPriority | null {
  return (
    typeof value === 'string' &&
    priorityValues.some((item) => item === value)
  )
    ? (value as CustomerPriority)
    : null;
}

function readInstant(value: unknown): string | null {
  if (typeof value !== 'string' || !canonicalInstant.test(value)) return null;
  const epochMs = Date.parse(value);
  return Number.isFinite(epochMs) && new Date(epochMs).toISOString() === value
    ? value
    : null;
}

function parseControlledFields(
  value: unknown,
  requireAll: boolean,
): ControlledChanges | null {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return null;
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);

    if (
      keys.some((key) => typeof key !== 'string') ||
      keys.length === 0 ||
      (requireAll && keys.length !== controlledFieldKeys.length) ||
      keys.some(
        (key) =>
          typeof key !== 'string' ||
          !controlledFieldKeys.includes(key as ControlledFieldKey),
      )
    ) {
      return null;
    }

    const result: ControlledChanges = {};

    for (const key of keys as string[]) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }

      const raw = descriptor.value;

      switch (key as ControlledFieldKey) {
        case 'displayName': {
          const parsed = readText(raw, 120, false);
          if (parsed === null) return null;
          result.displayName = parsed;
          break;
        }
        case 'lifecycle': {
          const parsed = readLifecycle(raw);
          if (!parsed) return null;
          result.lifecycle = parsed;
          break;
        }
        case 'priority': {
          const parsed = readPriority(raw);
          if (!parsed) return null;
          result.priority = parsed;
          break;
        }
        case 'ownerUserId': {
          if (typeof raw !== 'string' || !stableIdPattern.test(raw)) return null;
          result.ownerUserId = raw;
          break;
        }
        case 'projectInterest': {
          const parsed = readText(raw, 120, true);
          if (parsed === null) return null;
          result.projectInterest = parsed;
          break;
        }
      }
    }

    if (
      requireAll &&
      controlledFieldKeys.some((key) => !Object.hasOwn(result, key))
    ) {
      return null;
    }

    return Object.freeze(result);
  } catch {
    return null;
  }
}

function parseCreate(value: unknown): Required<ControlledChanges> | null {
  const fields = parseControlledFields(value, true);
  return fields ? (fields as Required<ControlledChanges>) : null;
}

function parseMutation(
  value: unknown,
): Readonly<{
  expectedUpdatedAt: string;
  changes: ControlledChanges;
}> | null {
  const input = snapshot(value, ['expectedUpdatedAt', 'changes']);
  if (!input) return null;

  const expectedUpdatedAt = readInstant(input.expectedUpdatedAt);
  const changes = parseControlledFields(input.changes, false);

  if (!expectedUpdatedAt || !changes) return null;
  return Object.freeze({ expectedUpdatedAt, changes });
}

function hasEffectiveChanges(
  current: CustomerCommandRecord,
  changes: ControlledChanges,
): boolean {
  return Object.entries(changes).some(
    ([key, value]) => current[key as ControlledFieldKey] !== value,
  );
}

function permissions(
  actor: InstitutionCustomerWriteAuthorizationConsumptionV1,
): CustomerControlledDtoV1['permissions'] {
  return Object.freeze({
    canUpdate: true,
    canReassignOwner: isManagement(actor.role),
  });
}

function toDto(
  record: CustomerCommandRecord,
  actor: InstitutionCustomerWriteAuthorizationConsumptionV1,
): CustomerControlledDtoV1 {
  return Object.freeze({
    contractVersion: 'v1' as const,
    customerId: record.id,
    displayName: record.displayName,
    lifecycle: record.lifecycle,
    priority: record.priority,
    ownerUserId: record.ownerUserId,
    projectInterest: record.projectInterest,
    updatedAt: record.updatedAt,
    permissions: permissions(actor),
  });
}

async function resolveCurrentOwner(
  actor: InstitutionCustomerWriteAuthorizationConsumptionV1,
  accountId: string,
): Promise<string | null> {
  const resolution =
    await createAccessControlAuthoritativeMembershipFactReaderV1().resolve({
      accountId,
      tenantId: actor.tenantId,
      institutionId: actor.institutionId,
    });

  if (
    resolution.kind !== 'current_membership_fact' ||
    !isInstitutionRoleV1(resolution.role)
  ) {
    return null;
  }

  return resolution.accountId;
}

function selectAuditReason(
  current: CustomerCommandRecord,
  changes: ControlledChanges,
): AuditReason {
  if (
    changes.ownerUserId !== undefined &&
    changes.ownerUserId !== current.ownerUserId
  ) {
    return 'customer_owner_reassigned';
  }
  if (
    changes.lifecycle !== undefined &&
    changes.lifecycle !== current.lifecycle
  ) {
    return 'customer_lifecycle_changed';
  }
  if (
    changes.priority !== undefined &&
    changes.priority !== current.priority
  ) {
    return 'customer_priority_changed';
  }
  return 'customer_profile_updated';
}

async function auditChanged(
  database: TenantDatabase,
  actor: InstitutionCustomerWriteAuthorizationConsumptionV1,
  customerId: string,
  action: 'create' | 'update',
  reason: AuditReason,
  occurredAt: string,
) {
  const attribution =
    await resolveInstitutionAuditWriterVerifiedAttributionV1({
      tenantId: actor.tenantId,
      institutionId: actor.institutionId,
    });
  if (!attribution) throw new Error('customer_audit_attribution_unavailable');

  const event = createVerifiedInstitutionAttributedTenantAuditEventV1({
    event: {
      eventId: randomUUID(),
      actorId: actor.accountId,
      actorRole: actor.role,
      tenantId: actor.tenantId,
      scope: 'tenant',
      resource: 'customer',
      resourceId: customerId,
      action,
      result: 'transitioned',
      reason,
      occurredAt,
      source: 'server_session',
    },
    attribution,
  });
  if (!event) throw new Error('customer_audit_event_invalid');

  await createAuditEventRepository(database).recordAttributed(event);
}

export async function readCurrentInstitutionCustomerControlledV1(
  customerId: string,
): Promise<CustomerControlledReadResultV1> {
  if (!stableIdPattern.test(customerId)) {
    return Object.freeze({ kind: 'not_found' as const });
  }

  const authorization = await authorize(false).catch(() => AUTH_UNAVAILABLE);
  if (authorization.kind !== 'allowed') {
    return Object.freeze({ kind: authorization.kind });
  }

  try {
    const record = await readScopedCustomerCommandRecordV1(getDatabase(), {
      tenantId: authorization.actor.tenantId,
      institutionId: authorization.actor.institutionId,
      customerId,
    });

    return record
      ? Object.freeze({
          kind: 'ready' as const,
          record: toDto(record, authorization.actor),
        })
      : Object.freeze({ kind: 'not_found' as const });
  } catch {
    return Object.freeze({ kind: 'unavailable' as const });
  }
}

export async function createCurrentInstitutionCustomerControlledV1(
  value: unknown,
): Promise<CustomerControlledMutationResultV1> {
  const authorization = await authorize(true).catch(() => AUTH_UNAVAILABLE);
  if (authorization.kind !== 'allowed') {
    return Object.freeze({ kind: authorization.kind });
  }

  const actor = authorization.actor;
  if (!isManagement(actor.role)) {
    return Object.freeze({ kind: 'forbidden' as const });
  }

  const input = parseCreate(value);
  if (!input) {
    return Object.freeze({
      kind: 'invalid' as const,
      code: 'invalid_customer_create',
    });
  }

  const ownerUserId = await resolveCurrentOwner(
    actor,
    input.ownerUserId,
  ).catch(() => null);

  if (!ownerUserId) {
    return Object.freeze({
      kind: 'invalid' as const,
      code: 'invalid_customer_owner',
    });
  }

  const database = getDatabase();

  try {
    return await database.transaction(async (transactionDatabase) => {
      const transactionDb = transactionDatabase as unknown as TenantDatabase;

      await lockTenantCustomerCreateQuotaV1({
        database: transactionDb,
        tenantId: actor.tenantId,
      });

      const quota = await checkTenantQuotaForCreate({
        database: transactionDb,
        resource: 'customers',
        tenantId: actor.tenantId,
      });
      if (!quota.allowed) {
        return Object.freeze({
          kind: 'quota_denied' as const,
          code: quota.reason,
        });
      }

      const service = createCustomerCommandService(
        createCustomerCommandRepository(transactionDb),
      );

      const created = await service.createCustomer({
        attribution: {
          tenantId: actor.tenantId,
          institutionId: actor.institutionId,
        },
        customer: {
          id: randomUUID(),
          displayName: input.displayName,
          lifecycle: input.lifecycle,
          priority: input.priority,
          ownerUserId,
          projectInterest: input.projectInterest,
          maskedPhone: '',
          maskedMedicalRecordNo: '',
          lastTouchSummary: '',
          nextAction: '',
          tags: [],
          gender: '',
          birthDate: '',
          referralSource: '',
          notes: '',
        },
      });

      await auditChanged(
        transactionDb,
        actor,
        created.id,
        'create',
        'customer_created',
        created.updatedAt,
      );

      return Object.freeze({
        kind: 'ready' as const,
        record: toDto(created, actor),
      });
    });
  } catch {
    return Object.freeze({ kind: 'unavailable' as const });
  }
}

export async function mutateCurrentInstitutionCustomerControlledV1(
  customerId: string,
  value: unknown,
): Promise<CustomerControlledMutationResultV1> {
  if (!stableIdPattern.test(customerId)) {
    return Object.freeze({ kind: 'not_found' as const });
  }

  const authorization = await authorize(false).catch(() => AUTH_UNAVAILABLE);
  if (authorization.kind !== 'allowed') {
    return Object.freeze({ kind: authorization.kind });
  }

  const actor = authorization.actor;
  const command = parseMutation(value);
  if (!command) {
    return Object.freeze({
      kind: 'invalid' as const,
      code: 'invalid_customer_update',
    });
  }

  const database = getDatabase();

  try {
    return await database.transaction(async (transactionDatabase) => {
      const transactionDb = transactionDatabase as unknown as TenantDatabase;
      const current = await readScopedCustomerCommandRecordV1(
        transactionDb,
        {
          tenantId: actor.tenantId,
          institutionId: actor.institutionId,
          customerId,
        },
      );

      if (!current) {
        return Object.freeze({ kind: 'not_found' as const });
      }
      if (current.updatedAt !== command.expectedUpdatedAt) {
        return Object.freeze({
          kind: 'conflict' as const,
          code: 'stale_update',
        });
      }
      if (!hasEffectiveChanges(current, command.changes)) {
        return Object.freeze({
          kind: 'invalid' as const,
          code: 'no_effective_customer_change',
        });
      }

      const changes: ControlledChanges = { ...command.changes };

      if (
        changes.ownerUserId !== undefined &&
        changes.ownerUserId !== current.ownerUserId
      ) {
        if (!isManagement(actor.role)) {
          return Object.freeze({ kind: 'forbidden' as const });
        }

        const ownerUserId = await resolveCurrentOwner(
          actor,
          changes.ownerUserId,
        ).catch(() => null);

        if (!ownerUserId) {
          return Object.freeze({
            kind: 'invalid' as const,
            code: 'invalid_customer_owner',
          });
        }
        changes.ownerUserId = ownerUserId;
      }

      const reason = selectAuditReason(current, changes);
      const service = createCustomerCommandService(
        createCustomerCommandRepository(transactionDb),
      );

      const updated = await service.updateCustomer({
        attribution: {
          tenantId: actor.tenantId,
          institutionId: actor.institutionId,
        },
        customerId,
        expectedUpdatedAt: command.expectedUpdatedAt,
        changes,
      });

      if (!updated) {
        return Object.freeze({
          kind: 'conflict' as const,
          code: 'stale_update',
        });
      }

      await auditChanged(
        transactionDb,
        actor,
        customerId,
        'update',
        reason,
        updated.updatedAt,
      );

      return Object.freeze({
        kind: 'ready' as const,
        record: toDto(updated, actor),
      });
    });
  } catch {
    return Object.freeze({ kind: 'unavailable' as const });
  }
}
