import { describe, expect, it } from 'vitest';

import { parseFormalFollowUpListQueryV1 } from '@/modules/care/application/formal-follow-up-list-query';

describe('正式随访查询契约', () => {
  it('无参保留第一页 100 条，允许查询后续页', () => {
    expect(parseFormalFollowUpListQueryV1(new URLSearchParams())).toEqual({
      page: 1, pageSize: 100, state: null, dueBucket: null, keyword: null,
    });
    expect(parseFormalFollowUpListQueryV1(new URLSearchParams(
      'page=12&pageSize=20&state=escalated&dueBucket=overdue&q=客户甲',
    ))).toEqual({ page: 12, pageSize: 20, state: 'escalated', dueBucket: 'overdue', keyword: '客户甲' });
  });

  it.each([
    'page=0', 'page=-1', 'page=1.5', 'page=1e2', 'page=01', 'page=',
    'page=9007199254740991&pageSize=100', 'page=1&page=2',
    'pageSize=101', 'pageSize=01', 'pageSize=15', 'pageSize=20&pageSize=20',
    'state=unknown', 'state=', 'state=pending&state=pending',
    'dueBucket=today', 'dueBucket=', 'q=', 'q=%20客户', 'q=客户%20', 'q=a%00b',
    `q=${'字'.repeat(81)}`, 'tenantId=other', 'institutionId=other', 'actorId=other',
    'actorRole=tenant_admin', 'timeZone=UTC', 'observedAt=2020-01-01', 'unknown=1',
  ])('拒绝非法或调用方控制权限的参数：%s', (query) => {
    expect(parseFormalFollowUpListQueryV1(new URLSearchParams(query))).toBeNull();
  });

  it('终态与到期桶组合保持 AND 语义，留给查询返回空集', () => {
    expect(parseFormalFollowUpListQueryV1(new URLSearchParams(
      'state=completed&dueBucket=overdue',
    ))).toMatchObject({ state: 'completed', dueBucket: 'overdue' });
  });
});
