export const OPPORTUNITY_RULE_VERSION = 'customer-lifecycle.v1';
export const OPPORTUNITY_DEFINITIONS = Object.freeze({
  revisit: { lifecycle: 'post_care', label: '复诊机会', basis: '客户主档生命周期 = 术后关怀' },
  repurchase: { lifecycle: 'repurchase_window', label: '复购机会', basis: '客户主档生命周期 = 复购窗口' },
  reactivation: { lifecycle: 'silent_reactivation', label: '沉默唤醒', basis: '客户主档生命周期 = 沉默唤醒' },
} as const);
export const OPPORTUNITY_PAGE_SIZES = [10, 20, 50, 100] as const;
export type OpportunityType = keyof typeof OPPORTUNITY_DEFINITIONS;
export type OpportunityPriority = 'high' | 'medium' | 'observe';
export type OpportunityQuery = Readonly<{
  page: number;
  pageSize: number;
  type: OpportunityType | 'all';
  priority: OpportunityPriority | null;
}>;
export type OpportunitySourceRow = Readonly<{
  tenantId: string;
  institutionId: string | null;
  customerId: string;
  displayName: string;
  lifecycle: string;
  priority: string;
  updatedAt: Date;
}>;
export type OpportunityCandidate = Readonly<{
  contractVersion: 'v1';
  customerId: string;
  displayName: string;
  lifecycle: string;
  priority: OpportunityPriority;
  updatedAt: string;
  opportunityType: OpportunityType;
  opportunityLabel: string;
  basis: string;
  sourceKind: 'customer_lifecycle';
  ruleVersion: typeof OPPORTUNITY_RULE_VERSION;
  sourceVersion: string;
}>;

export function opportunityTypeForLifecycle(lifecycle: string): OpportunityType | null {
  return (Object.keys(OPPORTUNITY_DEFINITIONS) as OpportunityType[])
    .find(key => OPPORTUNITY_DEFINITIONS[key].lifecycle === lifecycle) ?? null;
}

export function parseOpportunityQuery(params: URLSearchParams): OpportunityQuery | null {
  const allowed = new Set(['page', 'pageSize', 'type', 'priority']);
  if ([...params.keys()].some(key => !allowed.has(key) || params.getAll(key).length !== 1)) return null;
  const pageText = params.get('page') ?? '1';
  const sizeText = params.get('pageSize') ?? '20';
  const type = params.get('type') ?? 'all';
  const priority = params.get('priority');
  if (!/^[1-9][0-9]*$/u.test(pageText) || !/^[1-9][0-9]*$/u.test(sizeText)) return null;
  const page = Number(pageText); const pageSize = Number(sizeText);
  if (!Number.isSafeInteger(page) || page > 100
    || !OPPORTUNITY_PAGE_SIZES.some(size => size === pageSize)
    || (type !== 'all' && !Object.hasOwn(OPPORTUNITY_DEFINITIONS, type))
    || (priority !== null && !['high', 'medium', 'observe'].includes(priority))) return null;
  return Object.freeze({ page, pageSize, type: type as OpportunityQuery['type'], priority: priority as OpportunityPriority | null });
}

export function validOpportunitySource(row: OpportunitySourceRow, scope: Readonly<{
  tenantId: string; institutionId: string;
}>, query: OpportunityQuery): boolean {
  if (!row || row.tenantId !== scope.tenantId || row.institutionId !== scope.institutionId
    || typeof row.customerId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u.test(row.customerId)
    || typeof row.displayName !== 'string' || [...row.displayName].length > 120 || row.displayName.trim().length === 0
    || !['high', 'medium', 'observe'].includes(row.priority)
    || !(row.updatedAt instanceof Date) || !Number.isFinite(row.updatedAt.getTime())) return false;
  const type = opportunityTypeForLifecycle(row.lifecycle);
  return type !== null && (query.type === 'all' || type === query.type)
    && (query.priority === null || row.priority === query.priority);
}

export function opportunityPageInfo(query: OpportunityQuery, total: number) {
  const pageCount = total === 0 ? 0 : Math.min(100, Math.ceil(total / query.pageSize));
  return Object.freeze({ page: query.page, pageSize: query.pageSize, total, pageCount, hasMore: query.page < pageCount });
}
