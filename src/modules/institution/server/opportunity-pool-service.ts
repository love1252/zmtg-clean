import {
  deriveOpportunityType,
  opportunityTypeDescriptions,
  opportunityTypeLabels,
  type OpportunityPoolItem,
  type OpportunityPoolResponse,
  type TenantOpportunity,
} from '@/modules/institution/domain/opportunity-pool';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';

type GenerateOpportunityPoolsInput = {
  customers: readonly CustomerRecordSummary[];
  generatedAt: string;
};

function toOpportunity(customer: CustomerRecordSummary): TenantOpportunity {
  return {
    id: customer.id,
    tenantId: customer.tenantId,
    customerId: customer.id,
    customerDisplayName: customer.displayName,
    type: deriveOpportunityType(customer.lifecycle) ?? 'dormant_reactivation',
    lifecycle: customer.lifecycle,
    priority: customer.priority,
    suggestedAction: customer.nextAction,
    projectInterest: customer.projectInterest,
    ownerUserId: customer.ownerUserId,
  };
}

export function generateOpportunityPools(
  input: GenerateOpportunityPoolsInput,
): OpportunityPoolResponse {
  const opportunities = input.customers
    .filter((customer) => deriveOpportunityType(customer.lifecycle) !== null)
    .map(toOpportunity);

  const poolMap = new Map<OpportunityPoolItem['type'], TenantOpportunity[]>();

  for (const opportunity of opportunities) {
    const existing = poolMap.get(opportunity.type);
    if (existing) {
      existing.push(opportunity);
    } else {
      poolMap.set(opportunity.type, [opportunity]);
    }
  }

  const pools: OpportunityPoolItem[] = (['revisit', 'repurchase', 'dormant_reactivation'] as const)
    .map((type) => {
      const items = poolMap.get(type) ?? [];
      return {
        type,
        label: opportunityTypeLabels[type],
        description: opportunityTypeDescriptions[type],
        count: items.length,
        opportunities: items,
      };
    })
    .filter((pool) => pool.count > 0);

  return {
    pools,
    totalCount: opportunities.length,
    generatedAt: input.generatedAt,
  };
}
