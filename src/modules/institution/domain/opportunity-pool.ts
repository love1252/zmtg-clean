import type { CustomerLifecycleStage, CustomerPriority } from '@/modules/institution/domain/customer-records';

export type OpportunityType = 'revisit' | 'repurchase' | 'dormant_reactivation';

export type TenantOpportunity = {
  id: string;
  tenantId: string;
  customerId: string;
  customerDisplayName: string;
  type: OpportunityType;
  lifecycle: CustomerLifecycleStage;
  priority: CustomerPriority;
  suggestedAction: string;
  projectInterest: string;
  ownerUserId: string;
};

export type OpportunityPoolItem = {
  type: OpportunityType;
  label: string;
  description: string;
  count: number;
  opportunities: TenantOpportunity[];
};

export type OpportunityPoolResponse = {
  pools: OpportunityPoolItem[];
  totalCount: number;
  generatedAt: string;
};

export const opportunityTypeLabels: Record<OpportunityType, string> = {
  revisit: '复诊机会',
  repurchase: '复购机会',
  dormant_reactivation: '沉睡客户机会',
};

export const opportunityTypeDescriptions: Record<OpportunityType, string> = {
  revisit: '术后关怀期客户，适合安排复诊跟进',
  repurchase: '处于复购窗口期的客户，适合推荐新项目',
  dormant_reactivation: '长期未到院客户，适合通过关怀唤醒',
};

const lifecycleToOpportunityType: Partial<Record<CustomerLifecycleStage, OpportunityType>> = {
  post_care: 'revisit',
  repurchase_window: 'repurchase',
  silent_reactivation: 'dormant_reactivation',
};

export function deriveOpportunityType(
  lifecycle: CustomerLifecycleStage,
): OpportunityType | null {
  return lifecycleToOpportunityType[lifecycle] ?? null;
}
