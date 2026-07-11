import { createAuditEvent, type AuditReason } from '@/modules/audit/domain/audit-events';
import type { AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  consentBlocksPreparedAttempt,
  createWeComReachOutOperationRef,
  createWeComReachOutFrequencyWindow,
  decideWeComReachOutConsentTransition,
  type WeComReachOutConsentAction,
  type WeComReachOutConsentSourceType,
} from '@/modules/institution/domain/trusted-reachout-safety';
import type { TenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import type {
  TrustedReachOutSafetyRepository,
  WeComReachOutSafetyScope,
} from '@/modules/institution/server/trusted-reachout-safety-repository';
import type { AccessContext } from '@/modules/security/domain/access-control';

export type WeComReachOutSafetyReadResult = {
  consent: {
    status: 'unknown' | 'consented' | 'opted_out' | 'consent_revoked';
    sourceType: WeComReachOutConsentSourceType | null;
    recordedAt: string | null;
  };
  frequency: {
    windowStartedAt: string | null;
    windowEndsAt: string | null;
    preparedCount: number;
    completedCount: number;
    maxPreparedCount: 1;
    maxCompletedCount: 1;
    nextAllowedAt: string | null;
  };
};

type SafetyRepositories = {
  customerRepository: Pick<TenantBusinessRepository, 'getCustomerByTenantAndInstitution'>;
  safetyRepository: TrustedReachOutSafetyRepository;
};

type SafetyTransactionRepositories = SafetyRepositories & {
  auditRepository: Pick<AuditEventRepository, 'record'>;
};

function createSafetyAudit(input: {
  eventId: string;
  context: AccessContext;
  resourceId: string | null;
  reason: AuditReason;
  result: 'allowed' | 'denied' | 'transitioned';
  occurredAt: string;
}) {
  return createAuditEvent({
    eventId: input.eventId,
    context: input.context,
    resource: 'customer',
    resourceId: input.resourceId,
    action: 'update',
    result: input.result,
    reason: input.reason,
    occurredAt: input.occurredAt,
  });
}

export async function readWeComReachOutSafety(input: {
  scope: WeComReachOutSafetyScope;
  repositories: SafetyRepositories;
}): Promise<{ kind: 'found'; safety: WeComReachOutSafetyReadResult } | { kind: 'customer_not_found' }> {
  const customer = await input.repositories.customerRepository.getCustomerByTenantAndInstitution({
    tenantId: input.scope.tenantId,
    institutionId: input.scope.institutionId,
    id: input.scope.customerId,
  });
  if (!customer) return { kind: 'customer_not_found' };

  const [consent, frequency] = await Promise.all([
    input.repositories.safetyRepository.findConsent(input.scope),
    input.repositories.safetyRepository.findFrequency(input.scope),
  ]);
  return {
    kind: 'found',
    safety: {
      consent: {
        status: consent?.status ?? 'unknown',
        sourceType: consent?.sourceType ?? null,
        recordedAt: consent?.recordedAt ?? null,
      },
      frequency: {
        windowStartedAt: frequency?.windowStartedAt ?? null,
        windowEndsAt: frequency?.windowEndsAt ?? null,
        preparedCount: frequency?.preparedCount ?? 0,
        completedCount: frequency?.completedCount ?? 0,
        maxPreparedCount: 1,
        maxCompletedCount: 1,
        nextAllowedAt: frequency?.nextAllowedAt ?? null,
      },
    },
  };
}

export async function recordWeComReachOutConsent(input: {
  context: AccessContext;
  scope: WeComReachOutSafetyScope;
  action: WeComReachOutConsentAction;
  sourceType: WeComReachOutConsentSourceType;
  confirmation: string;
  occurredAt: string;
  createId: () => string;
  repositories: SafetyTransactionRepositories;
}) {
  const customer = await input.repositories.customerRepository.getCustomerByTenantAndInstitution({
    tenantId: input.scope.tenantId,
    institutionId: input.scope.institutionId,
    id: input.scope.customerId,
  });
  if (!customer) return { kind: 'customer_not_found' as const };

  const decision = decideWeComReachOutConsentTransition(input);
  if (decision.kind === 'invalid') return { kind: 'invalid_action' as const };

  const current = await input.repositories.safetyRepository.findConsent(input.scope);
  if (current?.status === decision.transition.status && current.sourceType === input.sourceType) {
    return { kind: 'idempotent' as const, consent: current };
  }

  const evidenceRef = `wcc_${input.createId()}`.slice(0, 96);
  const consent = await input.repositories.safetyRepository.upsertConsent({
    ...input.scope,
    id: input.createId(),
    status: decision.transition.status,
    sourceType: decision.transition.sourceType,
    evidenceRef,
    recordedBy: input.context.userId,
    recordedAt: new Date(input.occurredAt),
    expectedVersion: current?.version ?? null,
  });
  if (!consent) return { kind: 'conflict' as const };

  const reason: AuditReason = input.action === 'record_consent'
    ? 'wecom_reachout_consent_recorded'
    : input.action === 'record_opt_out'
      ? 'wecom_reachout_opt_out_recorded'
      : 'wecom_reachout_consent_revoked';
  await input.repositories.auditRepository.record(createSafetyAudit({
    eventId: input.createId(),
    context: input.context,
    resourceId: input.scope.customerId,
    reason,
    result: 'transitioned',
    occurredAt: input.occurredAt,
  }));
  return { kind: 'updated' as const, consent };
}

export async function reservePreparedAttempt(input: {
  context: AccessContext;
  scope: WeComReachOutSafetyScope;
  systemOperationId: string;
  occurredAt: string;
  createId: () => string;
  repositories: Pick<SafetyTransactionRepositories, 'safetyRepository' | 'auditRepository'>;
}) {
  const operationRef = createWeComReachOutOperationRef(input.systemOperationId);
  if (!operationRef) return { kind: 'invalid_operation' as const };
  const consent = await input.repositories.safetyRepository.findConsent(input.scope);
  const blockReason = consentBlocksPreparedAttempt(consent?.status ?? 'unknown');
  if (blockReason) return { kind: blockReason } as const;

  const now = new Date(input.occurredAt);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await input.repositories.safetyRepository.findFrequency(input.scope);
    if (current?.lastPreparedRef === operationRef) {
      return { kind: 'idempotent' as const, state: current };
    }

    if (!current) {
      const window = createWeComReachOutFrequencyWindow(now);
      const created = await input.repositories.safetyRepository.createFrequencyIfAbsent({
        ...input.scope,
        id: input.createId(),
        operationRef,
        now,
        windowEndsAt: window.windowEndsAt,
      });
      if (!created) continue;
      await input.repositories.auditRepository.record(createSafetyAudit({
        eventId: input.createId(), context: input.context, resourceId: input.scope.customerId,
        reason: 'wecom_reachout_frequency_reserved', result: 'transitioned', occurredAt: input.occurredAt,
      }));
      return { kind: 'reserved' as const, state: created };
    }

    const expired = new Date(current.windowEndsAt).getTime() <= now.getTime();
    if (!expired && current.preparedCount >= current.maxPreparedCount) {
      await input.repositories.auditRepository.record(createSafetyAudit({
        eventId: input.createId(), context: input.context, resourceId: input.scope.customerId,
        reason: 'wecom_reachout_frequency_blocked', result: 'denied', occurredAt: input.occurredAt,
      }));
      return { kind: 'frequency_cap_reached' as const, state: current };
    }

    const window = expired
      ? createWeComReachOutFrequencyWindow(now)
      : { windowStartedAt: new Date(current.windowStartedAt), windowEndsAt: new Date(current.windowEndsAt) };
    const updated = await input.repositories.safetyRepository.updateFrequencyWhenVersion({
      ...input.scope,
      operationRef,
      now,
      windowStartedAt: window.windowStartedAt,
      windowEndsAt: window.windowEndsAt,
      preparedCount: expired ? 1 : current.preparedCount + 1,
      completedCount: expired ? 0 : current.completedCount,
      nextAllowedAt: window.windowEndsAt,
      expectedVersion: current.version,
    });
    if (!updated) continue;
    await input.repositories.auditRepository.record(createSafetyAudit({
      eventId: input.createId(), context: input.context, resourceId: input.scope.customerId,
      reason: 'wecom_reachout_frequency_reserved', result: 'transitioned', occurredAt: input.occurredAt,
    }));
    return { kind: 'reserved' as const, state: updated };
  }

  return { kind: 'conflict' as const };
}
