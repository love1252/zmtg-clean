import {
  parseFormalFollowUpListQueryV1,
  type FormalFollowUpListQueryV1,
  type FormalFollowUpListSummaryV1,
} from '@/modules/care/application/formal-follow-up-list-query';

export const FORMAL_FOLLOW_UP_LIST_PATH = '/hospital/care/followups';
export type FollowUpPageSearchParams = Record<string, string | string[] | undefined>;
export type FormalFollowUpListPageV1 = Readonly<{
  query: FormalFollowUpListQueryV1;
  pageInfo: Readonly<{ page: number; pageSize: number; total: number; pageCount: number; hasMore: boolean }>;
  summary: FormalFollowUpListSummaryV1;
}>;

// 页面兼容既有工作台链接；API 仍只接收正式列表契约允许的查询键。
export function parseFormalFollowUpPageQueryV1(
  values: FollowUpPageSearchParams,
): FormalFollowUpListQueryV1 | null {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
    if (params.getAll(key).length !== 1) return null;
  }
  if (params.has('create')) {
    if (params.get('create') !== '1') return null;
    params.delete('create');
  }
  if (params.has('bucket')) {
    const bucket = params.get('bucket');
    if (params.has('dueBucket') || (bucket !== 'today' && bucket !== 'overdue')) return null;
    params.set('dueBucket', bucket === 'today' ? 'due_today' : 'overdue');
    params.delete('bucket');
  }
  if (!params.has('pageSize')) params.set('pageSize', '20');
  return parseFormalFollowUpListQueryV1(params);
}

export function formalFollowUpListParamsV1(query: FormalFollowUpListQueryV1): URLSearchParams {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.state !== null) params.set('state', query.state);
  if (query.dueBucket !== null) params.set('dueBucket', query.dueBucket);
  if (query.keyword !== null) params.set('q', query.keyword);
  return params;
}

export function formalFollowUpListHrefV1(query: FormalFollowUpListQueryV1): string {
  return `${FORMAL_FOLLOW_UP_LIST_PATH}?${formalFollowUpListParamsV1(query)}`;
}

export function safeFollowUpReturnHrefV1(value: string | string[] | undefined): string {
  if (typeof value !== 'string') return FORMAL_FOLLOW_UP_LIST_PATH;
  if (value === '/hospital') return value;
  try {
    const url = new URL(value, 'https://local.invalid');
    if (url.origin !== 'https://local.invalid' || url.hash) return FORMAL_FOLLOW_UP_LIST_PATH;
    if (url.pathname === FORMAL_FOLLOW_UP_LIST_PATH) {
      const values: FollowUpPageSearchParams = {};
      for (const key of url.searchParams.keys()) values[key] = url.searchParams.getAll(key);
      const query = parseFormalFollowUpPageQueryV1(values);
      return query ? formalFollowUpListHrefV1(query) : FORMAL_FOLLOW_UP_LIST_PATH;
    }
    if (/^\/hospital\/customers\/[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u.test(url.pathname)
      && url.search === '?tab=followups') return url.pathname + url.search;
  } catch { /* 返回固定站内列表，拒绝不可信重定向。 */ }
  return FORMAL_FOLLOW_UP_LIST_PATH;
}
