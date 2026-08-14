import type {
  AuditEventListItem,
  AuditEventQuery,
  AuditEventQueryResult,
  InstitutionAuditCoverage,
} from '@/modules/audit/domain/audit-event-query';
import { createInstitutionAuditCoverage } from '@/modules/audit/domain/audit-event-query';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  consumeInstitutionAuditReadAuthorizationV1,
  resolveInstitutionAuditReadAuthorizationV1,
} from '@/server/orchestration/institution-audit-read-authorization';
import { getDatabase } from '@/server/db/client';

export type InstitutionAuditEventListItemV1 = Omit<AuditEventListItem, 'tenantId'>;

export type InstitutionAuditReaderResultV1 =
  | {
      kind: 'ready';
      records: readonly InstitutionAuditEventListItemV1[];
      pageInfo: Readonly<AuditEventQueryResult['pageInfo']>;
      coverage: InstitutionAuditCoverage;
    }
  | { kind: 'forbidden' }
  | { kind: 'unavailable' };

const INSTITUTION_AUDIT_READER_FORBIDDEN = Object.freeze({
  kind: 'forbidden',
} as const);
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
    const resolution = await resolveInstitutionAuditReadAuthorizationV1();
    if (resolution.kind === 'forbidden') {
      return INSTITUTION_AUDIT_READER_FORBIDDEN;
    }
    if (resolution.kind !== 'allowed') {
      return INSTITUTION_AUDIT_READER_UNAVAILABLE;
    }

    const context = consumeInstitutionAuditReadAuthorizationV1(
      resolution.authorization,
    );
    if (!context) {
      return INSTITUTION_AUDIT_READER_UNAVAILABLE;
    }

    const repository = createAuditEventRepository(getDatabase());
    const coverageFacts = await repository.readInstitutionAuditCoverage({
      tenantId: context.tenantId,
      institutionId: context.institutionId,
    });
    const coverage = createInstitutionAuditCoverage(coverageFacts);
    if (!coverage) return INSTITUTION_AUDIT_READER_UNAVAILABLE;

    const result = await repository.listAuditEvents({
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
      coverage,
    });
  } catch {
    return INSTITUTION_AUDIT_READER_UNAVAILABLE;
  }
}
