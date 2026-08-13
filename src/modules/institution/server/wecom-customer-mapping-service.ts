import type {
  AuditReason,
  AuditResult,
  VerifiedInstitutionAuditAttributionHandleV1,
} from '@/modules/audit/domain/audit-events';
import {
  createAuditEvent,
  createVerifiedInstitutionAttributedTenantAuditEventV1,
} from '@/modules/audit/domain/audit-events';
import type { AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import {
  decideWeComCustomerMappingTransition,
  weComCustomerMappingProof,
  type PersistedWeComCustomerMappingStatus,
  type WeComCustomerMappingAction,
} from '@/modules/institution/domain/wecom-customer-mapping';
import type { TenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import type {
  WeComCustomerMappingRepository,
  WeComCustomerMappingState,
} from '@/modules/institution/server/wecom-customer-mapping-repository';
import type { AccessContext } from '@/modules/security/domain/access-control';

export type WeComCustomerMappingCandidate = {
  customerId: string;
  displayName: string;
  maskedPhone: string;
  maskedMedicalRecordNo: string;
  lifecycle: CustomerRecordSummary['lifecycle'];
  priority: CustomerRecordSummary['priority'];
};

export type WeComCustomerMappingReadResult = {
  mapping: {
    proofContactId: typeof weComCustomerMappingProof.proofContactId;
    proofEmployeeId: typeof weComCustomerMappingProof.proofEmployeeId;
    sourceMode: typeof weComCustomerMappingProof.sourceMode;
    status: PersistedWeComCustomerMappingStatus | 'unreviewed';
    customerId: string | null;
  };
  candidates: WeComCustomerMappingCandidate[];
  currentCustomer: WeComCustomerMappingCandidate | null;
};

export type WeComCustomerMappingWriteResult =
  | { kind: 'updated'; state: WeComCustomerMappingState }
  | { kind: 'idempotent'; state: WeComCustomerMappingState }
  | { kind: 'conflict' }
  | { kind: 'invalid_transition' }
  | { kind: 'customer_not_found' };

type MappingRepositories = {
  customerRepository: Pick<
    TenantBusinessRepository,
    'getCustomerByTenantAndInstitution' | 'listCustomersByTenantAndInstitution'
  >;
  mappingRepository: WeComCustomerMappingRepository;
};

type MappingTransactionRepositories = MappingRepositories & {
  auditRepository: Pick<AuditEventRepository, 'recordAttributed'>;
  auditAttribution: VerifiedInstitutionAuditAttributionHandleV1;
};

function toCandidate(customer: CustomerRecordSummary): WeComCustomerMappingCandidate {
  return {
    customerId: customer.id,
    displayName: customer.displayName,
    maskedPhone: customer.maskedPhone,
    maskedMedicalRecordNo: customer.maskedMedicalRecordNo,
    lifecycle: customer.lifecycle,
    priority: customer.priority,
  };
}

function createMappingAudit(input: {
  eventId: string;
  context: AccessContext;
  resourceId: string | null;
  result: AuditResult;
  reason: AuditReason;
  occurredAt: string;
  auditAttribution: VerifiedInstitutionAuditAttributionHandleV1;
}) {
  const event = createVerifiedInstitutionAttributedTenantAuditEventV1({
    event: createAuditEvent({
      eventId: input.eventId,
      context: input.context,
      resource: 'customer',
      resourceId: input.resourceId,
      action: 'update',
      result: input.result,
      reason: input.reason,
      occurredAt: input.occurredAt,
    }),
    attribution: input.auditAttribution,
  });
  if (!event) throw new Error('invalid_wecom_mapping_audit_attribution');
  return event;
}

function reasonForStatus(status: PersistedWeComCustomerMappingStatus): AuditReason {
  if (status === 'confirmed') return 'wecom_customer_mapping_confirmed';
  if (status === 'rejected') return 'wecom_customer_mapping_rejected';
  return 'wecom_customer_mapping_revoked';
}

export async function readWeComCustomerMapping(input: {
  tenantId: string;
  institutionId: string;
  repositories: MappingRepositories;
}): Promise<WeComCustomerMappingReadResult> {
  const [state, customers] = await Promise.all([
    input.repositories.mappingRepository.findByScope({
      tenantId: input.tenantId,
      institutionId: input.institutionId,
      proofContactId: weComCustomerMappingProof.proofContactId,
    }),
    input.repositories.customerRepository.listCustomersByTenantAndInstitution({
      tenantId: input.tenantId,
      institutionId: input.institutionId,
      limit: 20,
    }),
  ]);
  const candidates = customers.map(toCandidate);
  let currentCustomer = state
    ? (candidates.find((candidate) => candidate.customerId === state.customerId) ?? null)
    : null;

  if (state && !currentCustomer) {
    const mappedCustomer = await input.repositories.customerRepository.getCustomerByTenantAndInstitution({
      tenantId: input.tenantId,
      institutionId: input.institutionId,
      id: state.customerId,
    });
    currentCustomer = mappedCustomer ? toCandidate(mappedCustomer) : null;
  }

  return {
    mapping: {
      ...weComCustomerMappingProof,
      status: state?.status ?? 'unreviewed',
      customerId: state?.customerId ?? null,
    },
    candidates,
    currentCustomer,
  };
}

export async function writeWeComCustomerMapping(input: {
  context: AccessContext;
  tenantId: string;
  institutionId: string;
  action: WeComCustomerMappingAction;
  customerId: string;
  occurredAt: string;
  createId: () => string;
  repositories: MappingTransactionRepositories;
}): Promise<WeComCustomerMappingWriteResult> {
  const customer = await input.repositories.customerRepository.getCustomerByTenantAndInstitution({
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    id: input.customerId,
  });
  if (!customer) {
    await input.repositories.auditRepository.recordAttributed(
      createMappingAudit({
        eventId: input.createId(),
        context: input.context,
        resourceId: null,
        result: 'denied',
        reason: 'wecom_customer_mapping_customer_not_found',
        occurredAt: input.occurredAt,
        auditAttribution: input.repositories.auditAttribution,
      }),
    );
    return { kind: 'customer_not_found' };
  }

  const scope = {
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    proofContactId: weComCustomerMappingProof.proofContactId,
  };
  const current = await input.repositories.mappingRepository.findByScope(scope);
  const decision = decideWeComCustomerMappingTransition({
    current: current ? { status: current.status, customerId: current.customerId } : null,
    action: input.action,
    customerId: input.customerId,
  });

  if (decision.kind === 'conflict' || decision.kind === 'invalid_transition') {
    await input.repositories.auditRepository.recordAttributed(
      createMappingAudit({
        eventId: input.createId(),
        context: input.context,
        resourceId: input.customerId,
        result: 'denied',
        reason:
          decision.kind === 'conflict'
            ? 'wecom_customer_mapping_conflict_blocked'
            : 'wecom_customer_mapping_invalid_transition',
        occurredAt: input.occurredAt,
        auditAttribution: input.repositories.auditAttribution,
      }),
    );
    return { kind: decision.kind };
  }

  if (decision.kind === 'idempotent') {
    return current ? { kind: 'idempotent', state: current } : { kind: 'conflict' };
  }

  const state = current
    ? await input.repositories.mappingRepository.updateWhenCurrentStatus({
        ...scope,
        customerId: decision.customerId,
        expectedCustomerId: current.customerId,
        expectedStatus: current.status,
        status: decision.toStatus,
        decidedBy: input.context.userId,
        decidedAt: input.occurredAt,
      })
    : await input.repositories.mappingRepository.createIfAbsent({
        ...scope,
        id: input.createId(),
        proofEmployeeId: weComCustomerMappingProof.proofEmployeeId,
        sourceMode: weComCustomerMappingProof.sourceMode,
        customerId: decision.customerId,
        status: decision.toStatus,
        decidedBy: input.context.userId,
        decidedAt: input.occurredAt,
      });

  if (!state) {
    await input.repositories.auditRepository.recordAttributed(
      createMappingAudit({
        eventId: input.createId(),
        context: input.context,
        resourceId: input.customerId,
        result: 'denied',
        reason: 'wecom_customer_mapping_conflict_blocked',
        occurredAt: input.occurredAt,
        auditAttribution: input.repositories.auditAttribution,
      }),
    );
    return { kind: 'conflict' };
  }

  await input.repositories.auditRepository.recordAttributed(
    createMappingAudit({
      eventId: input.createId(),
      context: input.context,
      resourceId: state.customerId,
      result: 'transitioned',
      reason: reasonForStatus(state.status),
      occurredAt: input.occurredAt,
      auditAttribution: input.repositories.auditAttribution,
    }),
  );
  return { kind: 'updated', state };
}
