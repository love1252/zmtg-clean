import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type { FollowUpPathAnalysisAuditEvent } from '@/modules/institution/domain/followup-path-analysis';
import {
  createAuditEventQueryCursor,
  type AuditEventQuery,
  type AuditEventQueryResult,
  type AuditEventQueryScope,
} from '@/modules/audit/domain/audit-event-query';
import { mapAuditEventRowToListItem } from '@/modules/audit/server/audit-event-dto';
import type { TenantDatabase } from '@/server/db/client';
import { auditEvents, customers, followUpMessageDrafts } from '@/server/db/schema';

type AuditEventRow = typeof auditEvents.$inferSelect;

export type CustomerAuditEventSummary = {
  id: string;
  action: AuditEventRow['action'];
  result: AuditEventRow['result'];
  reason: AuditEventRow['reason'];
  actor: {
    id: string;
    role: AuditEventRow['actorRole'];
  };
  occurredAt: string;
  resource: AuditEventRow['resource'];
  resourceId: string | null;
};

export function mapAuditEventToInsert(event: TenantAuditEvent): typeof auditEvents.$inferInsert {
  return {
    eventId: event.eventId,
    actorId: event.actorId,
    actorRole: event.actorRole,
    tenantId: event.tenantId,
    scope: event.scope,
    resource: event.resource,
    resourceId: event.resourceId ?? null,
    action: event.action,
    result: event.result,
    reason: event.reason,
    occurredAt: new Date(event.occurredAt),
    source: event.source,
  };
}

function mapAuditEventRowToSummary(row: AuditEventRow): CustomerAuditEventSummary {
  return {
    id: row.eventId,
    action: row.action,
    result: row.result,
    reason: row.reason,
    actor: {
      id: row.actorId,
      role: row.actorRole,
    },
    occurredAt: row.occurredAt.toISOString(),
    resource: row.resource,
    resourceId: row.resourceId,
  };
}

function sortAuditEventSummaries(events: CustomerAuditEventSummary[]) {
  return [...events].sort((left, right) => {
    const timeDiff = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
    if (timeDiff !== 0) return timeDiff;

    return left.id.localeCompare(right.id);
  });
}

function buildAuditEventQueryConditions(input: {
  scope: AuditEventQueryScope;
  query: AuditEventQuery;
}) {
  const conditions = [];
  const { filters } = input.query;

  if (input.scope.kind === 'institution') {
    conditions.push(eq(auditEvents.tenantId, input.scope.tenantId));
  } else {
    const platformTenantId = input.scope.tenantId;
    if (platformTenantId === null) {
      conditions.push(isNull(auditEvents.tenantId));
    } else if (typeof platformTenantId === 'string') {
      conditions.push(eq(auditEvents.tenantId, platformTenantId));
    }
  }

  if (filters.from) {
    conditions.push(gte(auditEvents.occurredAt, new Date(filters.from)));
  }

  if (filters.to) {
    conditions.push(lte(auditEvents.occurredAt, new Date(filters.to)));
  }

  if (filters.resource) {
    conditions.push(eq(auditEvents.resource, filters.resource));
  }

  if (filters.resourceId) {
    conditions.push(eq(auditEvents.resourceId, filters.resourceId));
  }

  if (filters.action) {
    conditions.push(eq(auditEvents.action, filters.action));
  }

  if (filters.result) {
    conditions.push(eq(auditEvents.result, filters.result));
  }

  if (filters.reason) {
    conditions.push(eq(auditEvents.reason, filters.reason));
  }

  if (filters.actorId) {
    conditions.push(eq(auditEvents.actorId, filters.actorId));
  }

  if (input.query.cursor) {
    const cursorOccurredAt = new Date(input.query.cursor.occurredAt);
    conditions.push(
      or(
        lt(auditEvents.occurredAt, cursorOccurredAt),
        and(
          eq(auditEvents.occurredAt, cursorOccurredAt),
          gt(auditEvents.eventId, input.query.cursor.eventId),
        ),
      ),
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function mapRowsToAuditQueryResult(
  rows: AuditEventRow[],
  limit: number,
): AuditEventQueryResult {
  const visibleRows = rows.slice(0, limit);
  const records = visibleRows.map(mapAuditEventRowToListItem);
  const lastRecord = records.at(-1);

  return {
    records,
    pageInfo: {
      hasMore: rows.length > limit,
      limit,
      nextCursor:
        rows.length > limit && lastRecord
          ? createAuditEventQueryCursor({
              id: lastRecord.id,
              occurredAt: lastRecord.occurredAt,
            })
          : null,
    },
  };
}

export function createAuditEventRepository(database: TenantDatabase) {
  return {
    async record(event: TenantAuditEvent) {
      await database.insert(auditEvents).values(mapAuditEventToInsert(event));
    },
    async listCustomerAuditEventsByResourceId(input: {
      tenantId: string;
      institutionId: string;
      customerId: string;
    }): Promise<CustomerAuditEventSummary[]> {
      const [customerRows, followUpRows] = await Promise.all([
        database
          .select({ audit: auditEvents })
          .from(auditEvents)
          .innerJoin(
            customers,
            and(
              eq(auditEvents.resourceId, customers.id),
              eq(auditEvents.tenantId, customers.tenantId),
            ),
          )
          .where(
            and(
              eq(auditEvents.tenantId, input.tenantId),
              eq(auditEvents.resource, 'customer'),
              eq(auditEvents.resourceId, input.customerId),
              eq(customers.tenantId, input.tenantId),
              eq(customers.institutionId, input.institutionId),
              eq(customers.id, input.customerId),
            ),
          ),
        database
          .select({ audit: auditEvents })
          .from(auditEvents)
          .innerJoin(
            followUpMessageDrafts,
            and(
              eq(auditEvents.resourceId, followUpMessageDrafts.id),
              eq(auditEvents.tenantId, followUpMessageDrafts.tenantId),
            ),
          )
          .where(
            and(
              eq(auditEvents.tenantId, input.tenantId),
              eq(auditEvents.resource, 'follow_up'),
              eq(followUpMessageDrafts.institutionId, input.institutionId),
              eq(followUpMessageDrafts.customerId, input.customerId),
              inArray(auditEvents.reason, [
                'wecom_controlled_reachout_ready_no_send',
                'wecom_controlled_reachout_draft_not_approved',
                'wecom_controlled_reachout_delivery_missing',
                'wecom_controlled_reachout_delivery_not_unique',
                'wecom_controlled_reachout_delivery_customer_mismatch',
                'wecom_controlled_reachout_delivery_not_internal_mock',
                'wecom_controlled_reachout_mapping_not_confirmed',
                'wecom_controlled_reachout_mapping_customer_mismatch',
                'wecom_controlled_reachout_customer_not_found',
                'wecom_controlled_reachout_consent_missing',
                'wecom_controlled_reachout_consent_revoked',
                'wecom_controlled_reachout_opt_out',
                'wecom_controlled_reachout_frequency_cap_reached',
                'wecom_controlled_reachout_dry_run_not_ready',
                'wecom_controlled_reachout_conflict',
              ]),
            ),
          ),
      ]);

      return sortAuditEventSummaries([
        ...customerRows.map((row) => mapAuditEventRowToSummary(row.audit)),
        ...followUpRows.map((row) => mapAuditEventRowToSummary(row.audit)),
      ]);
    },
    async listAuditEvents(input: {
      scope: AuditEventQueryScope;
      query: AuditEventQuery;
    }): Promise<AuditEventQueryResult> {
      const rows = await database
        .select()
        .from(auditEvents)
        .where(buildAuditEventQueryConditions(input))
        .orderBy(desc(auditEvents.occurredAt), asc(auditEvents.eventId))
        .limit(input.query.limit + 1);

      return mapRowsToAuditQueryResult(rows, input.query.limit);
    },
    async listFollowUpPathAnalysisAuditEventsByTenant(
      tenantId: string,
    ): Promise<FollowUpPathAnalysisAuditEvent[]> {
      const rows = await database
        .select({
          tenantId: auditEvents.tenantId,
          resource: auditEvents.resource,
          resourceId: auditEvents.resourceId,
          result: auditEvents.result,
          reason: auditEvents.reason,
        })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.tenantId, tenantId),
            eq(auditEvents.resource, 'follow_up'),
            inArray(auditEvents.reason, [
              'voided_treatment_summary_follow_up_blocked',
              'active_source_follow_up_exists',
            ]),
          ),
        );

      return rows
        .filter((row) => row.tenantId === tenantId)
        .map((row) => ({
          auditResource: row.resource,
          auditResult: row.result,
          auditReason: row.reason,
          resourceId: row.resourceId,
        }));
    },
  };
}

export type AuditEventRepository = ReturnType<typeof createAuditEventRepository>;
