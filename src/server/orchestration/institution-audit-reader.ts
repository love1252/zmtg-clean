import type {
  AuditEventListItem,
  AuditEventQuery,
  AuditEventQueryResult,
} from '@/modules/audit/domain/audit-event-query';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  consumeInstitutionCapabilityAuthorityRuntimeContextV1,
  resolveInstitutionCapabilityAuthorityRuntimeContextV1,
} from '@/modules/institution/server/institution-server-runtime';
import { getDatabase } from '@/server/db/client';

export type InstitutionAuditEventListItemV1 = Omit<AuditEventListItem, 'tenantId'>;

export type InstitutionAuditReaderResultV1 =
  | {
      kind: 'ready';
      records: readonly InstitutionAuditEventListItemV1[];
      pageInfo: Readonly<AuditEventQueryResult['pageInfo']>;
    }
  | { kind: 'unavailable' };

const INSTITUTION_AUDIT_READER_UNAVAILABLE = Object.freeze({
  kind: 'unavailable',
} as const);

function mapInstitutionAuditEventListItem(
  record: AuditEventListItem,
): InstitutionAuditEventListItemV1 {
  return Object.freeze({
    id: record.id,
    resource: record.resource,
    resourceId: record.resourceId,
    action: record.action,
    result: record.result,
    reason: record.reason,
    actorId: record.actorId,
    actorRole: record.actorRole,
    occurredAt: record.occurredAt,
  });
}

export async function readCurrentInstitutionAuditEventsV1(
  query: AuditEventQuery,
): Promise<InstitutionAuditReaderResultV1> {
  try {
    const handle = await resolveInstitutionCapabilityAuthorityRuntimeContextV1();
    if (!handle) return INSTITUTION_AUDIT_READER_UNAVAILABLE;

    const context =
      consumeInstitutionCapabilityAuthorityRuntimeContextV1(handle);
    if (!context || !context.availableSectionIds.includes('system')) {
      return INSTITUTION_AUDIT_READER_UNAVAILABLE;
    }

    const result = await createAuditEventRepository(getDatabase()).listAuditEvents({
      scope: {
        kind: 'institution',
        tenantId: context.tenantId,
        institutionId: context.institutionId,
      },
      query,
    });
    const records = result.records.map(mapInstitutionAuditEventListItem);
    Object.freeze(records);

    return Object.freeze({
      kind: 'ready',
      records,
      pageInfo: Object.freeze({
        hasMore: result.pageInfo.hasMore,
        limit: result.pageInfo.limit,
        nextCursor: result.pageInfo.nextCursor,
      }),
    });
  } catch {
    return INSTITUTION_AUDIT_READER_UNAVAILABLE;
  }
}
