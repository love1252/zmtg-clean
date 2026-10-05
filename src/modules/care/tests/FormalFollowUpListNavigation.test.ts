import { describe, expect, it } from 'vitest';
import { formalFollowUpListHrefV1, formalFollowUpListParamsV1, parseFormalFollowUpPageQueryV1 } from '@/modules/care/application/formal-follow-up-list-navigation';

describe('正式随访页面查询', () => {
  it('页面默认20条，并保留工作台新建和到期入口', () => {
    expect(parseFormalFollowUpPageQueryV1({})).toEqual({ page: 1, pageSize: 20, state: null, dueBucket: null, keyword: null });
    expect(parseFormalFollowUpPageQueryV1({ create: '1', bucket: 'today' })?.dueBucket).toBe('due_today');
    expect(parseFormalFollowUpPageQueryV1({ bucket: 'overdue' })?.dueBucket).toBe('overdue');
    expect(formalFollowUpListParamsV1(parseFormalFollowUpPageQueryV1({ create: '1' })!).has('create')).toBe(false);
  });
  it('URL编码组合条件并保持往返一致', () => {
    const query = parseFormalFollowUpPageQueryV1({ page: '6', pageSize: '20', state: 'pending', dueBucket: 'overdue', q: '客户 & A+1' })!;
    const href = formalFollowUpListHrefV1(query);
    expect(href).toContain('/hospital/care/followups?page=6&pageSize=20&state=pending&dueBucket=overdue&q=');
    expect(parseFormalFollowUpPageQueryV1(Object.fromEntries(new URL(href, 'http://localhost').searchParams))).toEqual(query);
  });
  it.each([
    { page: ['1', '2'] }, { state: ['pending', 'pending'] }, { create: ['1', '1'] }, { create: '2' },
    { bucket: ['today', 'overdue'] }, { bucket: 'later' }, { bucket: 'today', dueBucket: 'due_today' },
    { tenantId: 'other' }, { page: '0' }, { pageSize: '30' }, { q: '' }, { q: 'a\n' }, { q: 'a'.repeat(81) },
  ])('拒绝重复、歧义、未知或非法参数：%j', (params) => {
    expect(parseFormalFollowUpPageQueryV1(params)).toBeNull();
  });
});
