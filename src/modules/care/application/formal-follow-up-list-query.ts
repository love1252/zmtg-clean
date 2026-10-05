import {
  FOLLOW_UP_DUE_BUCKETS,
  type FollowUpDueBucket,
} from '@/modules/care/domain/follow-up-due-bucket';
import {
  isFollowUpTaskState,
  type FollowUpTaskState,
} from '@/modules/care/domain/follow-up-task';

export const FORMAL_FOLLOW_UP_PAGE_SIZES = [10, 20, 50, 100] as const;

export type FormalFollowUpListQueryV1 = Readonly<{
  page: number;
  pageSize: (typeof FORMAL_FOLLOW_UP_PAGE_SIZES)[number];
  state: FollowUpTaskState | null;
  dueBucket: FollowUpDueBucket | null;
  keyword: string | null;
}>;

export type FormalFollowUpListSummaryV1 = Readonly<{
  total: number;
  stateCounts: Readonly<Record<FollowUpTaskState, number>>;
  // 缺少可信机构时区时不推断到期桶，也不以零代替缺失。
  dueBucketCounts: Readonly<Record<FollowUpDueBucket, number>> | null;
}>;

export function parseFormalFollowUpListQueryV1(
  params: URLSearchParams,
): FormalFollowUpListQueryV1 | null {
  const allowed = new Set(['page', 'pageSize', 'state', 'dueBucket', 'q']);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) return null;
  }

  const pageText = params.get('page') ?? '1';
  const pageSizeText = params.get('pageSize') ?? '100';
  if (!/^[1-9]\d{0,15}$/u.test(pageText) || !/^[1-9]\d{0,2}$/u.test(pageSizeText)) {
    return null;
  }
  const page = Number(pageText);
  const pageSize = Number(pageSizeText);
  if (
    !Number.isSafeInteger(page)
    || !Number.isSafeInteger((page - 1) * pageSize)
    || !FORMAL_FOLLOW_UP_PAGE_SIZES.some((size) => size === pageSize)
  ) return null;

  const state = params.get('state');
  if (state !== null && !isFollowUpTaskState(state)) return null;
  const dueBucket = params.get('dueBucket');
  if (dueBucket !== null && !FOLLOW_UP_DUE_BUCKETS.some((bucket) => bucket === dueBucket)) {
    return null;
  }
  const keyword = params.get('q');
  if (
    keyword !== null
    && (keyword.length === 0 || keyword.length > 80 || keyword.trim() !== keyword
      || /[\u0000-\u001f\u007f]/u.test(keyword))
  ) return null;

  return Object.freeze({
    page,
    pageSize: pageSize as FormalFollowUpListQueryV1['pageSize'],
    state,
    dueBucket: dueBucket as FollowUpDueBucket | null,
    keyword,
  });
}
