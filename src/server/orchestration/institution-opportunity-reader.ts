import { createHash } from 'node:crypto';

import {
  OPPORTUNITY_DEFINITIONS,
  OPPORTUNITY_RULE_VERSION,
  opportunityPageInfo,
  opportunityTypeForLifecycle,
  parseOpportunityQuery,
  validOpportunitySource,
  type OpportunityCandidate,
  type OpportunityPriority,
  type OpportunitySourceRow,
} from '@/modules/opportunities/domain/opportunity-candidate';
import { createOpportunityCandidateRepository } from '@/modules/opportunities/server/opportunity-candidate-repository';
import { getDatabase } from '@/server/db/client';
import {
  consumeInstitutionCustomerReadAuthorizationV1,
  resolveInstitutionCustomerReadAuthorizationV1,
} from '@/server/orchestration/institution-customer-read-authorization';

export async function readCurrentInstitutionOpportunitiesV1(params: URLSearchParams) {
  try {
    const resolution = await resolveInstitutionCustomerReadAuthorizationV1();
    if (resolution.kind !== 'allowed') return Object.freeze({ kind: resolution.kind });
    const scope = consumeInstitutionCustomerReadAuthorizationV1(resolution.authorization);
    if (!scope) return Object.freeze({ kind: 'unavailable' as const });
    const query = parseOpportunityQuery(params);
    if (!query) return Object.freeze({ kind: 'invalid_query' as const });
    const snapshot = await createOpportunityCandidateRepository(getDatabase()).read({
      tenantId: scope.tenantId, institutionId: scope.institutionId, query,
    });
    const { total, rows } = snapshot;
    if (!Number.isSafeInteger(total) || total === undefined || total < 0 || !Array.isArray(rows)
      || rows.length !== Math.min(query.pageSize, Math.max(0, total - (query.page - 1) * query.pageSize))
      || rows.some(row => !validOpportunitySource(row, scope, query))
      || new Set(rows.map(row => row.customerId)).size !== rows.length) throw new Error('invalid_opportunity_snapshot');
    const records: readonly OpportunityCandidate[] = rows.map(row => {
      const opportunityType = opportunityTypeForLifecycle(row.lifecycle)!;
      const definition = OPPORTUNITY_DEFINITIONS[opportunityType];
      const updatedAt = row.updatedAt.toISOString();
      const sourceVersion = opportunitySourceVersionV1(scope, row);
      return Object.freeze({
        contractVersion: 'v1', customerId: row.customerId, displayName: row.displayName,
        lifecycle: row.lifecycle, priority: row.priority as OpportunityPriority, updatedAt,
        opportunityType, opportunityLabel: definition.label, basis: definition.basis,
        sourceKind: 'customer_lifecycle', ruleVersion: OPPORTUNITY_RULE_VERSION, sourceVersion,
      });
    });
    return Object.freeze({
      kind: 'ready' as const, contractVersion: 'opportunity-candidates.v1' as const,
      records: Object.freeze(records), pageInfo: opportunityPageInfo(query, total),
    });
  } catch {
    return Object.freeze({ kind: 'unavailable' as const });
  }
}

export function opportunitySourceVersionV1(scope: { tenantId: string; institutionId: string }, row: OpportunitySourceRow) {
  return 'opp-src-v1:' + createHash('sha256').update(JSON.stringify([
    OPPORTUNITY_RULE_VERSION, scope.tenantId, scope.institutionId,
    row.customerId, row.lifecycle, row.priority, row.updatedAt.toISOString(),
  ])).digest('hex');
}
