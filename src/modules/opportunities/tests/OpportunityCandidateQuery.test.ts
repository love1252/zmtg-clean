import { describe, expect, it } from 'vitest';
import { opportunityPageInfo, opportunityTypeForLifecycle, parseOpportunityQuery } from '@/modules/opportunities/domain/opportunity-candidate';

describe('机会候选查询契约', () => {
  it('默认查询和三种生命周期映射', () => {
    expect(parseOpportunityQuery(new URLSearchParams())).toEqual({ page: 1, pageSize: 20, type: 'all', priority: null });
    expect(['post_care', 'repurchase_window', 'silent_reactivation', 'consulting'].map(opportunityTypeForLifecycle))
      .toEqual(['revisit', 'repurchase', 'reactivation', null]);
  });
  it.each(['revisit', 'repurchase', 'reactivation'])('允许%s与观察优先级', type => {
    expect(parseOpportunityQuery(new URLSearchParams({ type, priority: 'observe', page: '100', pageSize: '100' })))
      .toEqual({ type, priority: 'observe', page: 100, pageSize: 100 });
  });
  it.each(['page=0', 'page=101', 'page=1.5', 'page=01', 'pageSize=11', 'type=__proto__', 'type=dormant_reactivation', 'priority=watch', 'priority=', 'page=1&page=2', 'keyword=a', 'tenantId=other', 'role=tenant_admin'])('拒绝%s', query => {
    expect(parseOpportunityQuery(new URLSearchParams(query))).toBeNull();
  });
  it('总数独立于100页浏览限制，空集与越界页不伪造hasMore', () => {
    const query = parseOpportunityQuery(new URLSearchParams())!;
    expect(opportunityPageInfo(query, 3000)).toEqual({ page: 1, pageSize: 20, total: 3000, pageCount: 100, hasMore: true });
    expect(opportunityPageInfo(query, 0)).toMatchObject({ total: 0, pageCount: 0, hasMore: false });
    expect(opportunityPageInfo({ ...query, page: 5 }, 1)).toMatchObject({ page: 5, total: 1, pageCount: 1, hasMore: false });
  });
});
