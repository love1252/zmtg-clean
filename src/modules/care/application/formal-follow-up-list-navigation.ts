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
