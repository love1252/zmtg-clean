export const CUSTOMER_QUERY_PARAM_KEYS = Object.freeze([
  'lifecycle',
  'priority',
  'ownerId',
  'projectId',
  'tag',
  'lastTouchedFrom',
  'lastTouchedTo',
  'sort',
  'direction',
  'page',
] as const);

export const CUSTOMER_LIFECYCLES = Object.freeze([
  'consulting',
  'scheduled',
  'post_care',
  'repurchase_window',
  'silent_reactivation',
] as const);

export const CUSTOMER_PRIORITIES = Object.freeze(['high', 'medium', 'watch'] as const);
export const CUSTOMER_QUERY_DIRECTIONS = Object.freeze(['asc', 'desc'] as const);
export const CUSTOMER_SEARCH_FIELDS = Object.freeze(['displayName', 'maskedReference'] as const);

export type CustomerQueryParamKey = (typeof CUSTOMER_QUERY_PARAM_KEYS)[number];
export type CustomerLifecycle = (typeof CUSTOMER_LIFECYCLES)[number];
export type CustomerPriority = (typeof CUSTOMER_PRIORITIES)[number];
export type CustomerQueryDirection = (typeof CUSTOMER_QUERY_DIRECTIONS)[number];

export type CustomerQuery<TSort extends string> = {
  lifecycle: CustomerLifecycle | null;
  priority: CustomerPriority | null;
  ownerId: string | null;
  projectId: string | null;
  tag: string | null;
  lastTouchedFrom: string | null;
  lastTouchedTo: string | null;
  sort: TSort;
  direction: CustomerQueryDirection;
  page: number;
};

export type CustomerQueryPolicy<TSort extends string> = {
  allowedOwnerIds: ReadonlySet<string>;
  allowedProjectIds: ReadonlySet<string>;
  allowedTags: ReadonlySet<string>;
  allowedSorts: ReadonlySet<TSort>;
  defaultSort: TSort;
  defaultDirection: CustomerQueryDirection;
  defaultPage: number;
  maxPage: number;
};

export type CustomerQueryParseResult<TSort extends string> =
  | {
      source: 'parsed';
      code: null;
      query: CustomerQuery<TSort>;
    }
  | {
      source: 'safe_default';
      code: 'invalid_customer_query';
      query: CustomerQuery<TSort>;
    };

export type CustomerSearchIntentResult =
  | {
      ok: true;
      intent: {
        keyword: string;
        fields: typeof CUSTOMER_SEARCH_FIELDS;
      } | null;
    }
  | {
      ok: false;
      code: 'sensitive_customer_search';
    };

const allowedParamKeys = new Set<string>(CUSTOMER_QUERY_PARAM_KEYS);
const sensitiveSearchPatterns: readonly RegExp[] = [
  /(?:^|[^\d])(?:\+?86[-\s]?)?1[3-9]\d(?:[-\s]?\d){8}(?:$|[^\d])/u,
  /(?:^|[^\d])\d(?:[-\s]?\d){14}(?:$|[^\d])/u,
  /(?:^|[^\d])\d(?:[-\s]?\d){16}[-\s]?[0-9Xx](?:$|[^\d])/u,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/iu,
  /\b[a-z][a-z0-9+.-]*:\/\//iu,
  /(?:^|[\s([{])\/\/[^\s)\]}]+/u,
  /\b(?:file|ssh|sftp|scp|mailto|tel|data):/iu,
  /\bwww\./iu,
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,62})\.)+(?:[a-z]{2,63}|invalid)(?::\d{1,5})?(?:[/?#]\S*)?/iu,
  /\b(?:localhost|(?:\d{1,3}\.){3}\d{1,3})(?::\d{1,5})?(?:[/?#]\S*)?/iu,
  /\b(?:host|server|data[\s_-]?source|database|dbname|user[\s_-]?id|uid|password|pwd)\s*=\s*\S+/iu,
  /\b(?:secret|token|api[\s_-]?key|authorization|bearer|database_url|connection[\s_-]?string)\b/iu,
  /\b(?:sk|pk)-(?:live|test|proj)-[A-Za-z0-9_-]{4,}\b/iu,
  /\b(?:gh[pousr]_[A-Za-z0-9]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|AKIA[A-Z0-9]{12,})\b/u,
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*(?:$|[^A-Za-z0-9_-])/u,
  /\b(?:external[\s_-]?id|external_userid|sourcecustomerid|source_customer_id|open_?id|union_?id|corp_?id|wxid)(?:\b|[_:=/-])/iu,
  /(?:(?:病历|病案|档案)(?:号|编号)?|客户(?:编号|号))\s*[:：#=_-]?\s*[A-Za-z0-9][A-Za-z0-9_-]{3,}/u,
  /\b(?:mrn|medical[\s_-]?record(?:[\s_-]?(?:number|no))?|record[\s_-]?(?:id|number|no))\s*[:#=_-]?\s*[A-Za-z0-9][A-Za-z0-9_-]{3,}\b/iu,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu,
  /(?:^|[^0-9a-f])(?:[0-9a-f]{24}|[0-9a-f]{32})(?:$|[^0-9a-f])/iu,
  /\b[0-9A-HJKMNP-TV-Z]{26}\b/iu,
  /[\u0000-\u001f\u007f]/u,
];

export function isLowSensitiveCustomerText(input: string) {
  const normalized = input.trim();
  return (
    normalized.length > 0 &&
    !sensitiveSearchPatterns.some((pattern) => pattern.test(normalized))
  );
}

function isOneOf<const TValues extends readonly string[]>(
  value: string,
  values: TValues,
): value is TValues[number] {
  return (values as readonly string[]).includes(value);
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function createSafeDefaultQuery<TSort extends string>(
  policy: CustomerQueryPolicy<TSort>,
): CustomerQuery<TSort> {
  if (
    !policy.allowedSorts.has(policy.defaultSort) ||
    !isOneOf(policy.defaultDirection, CUSTOMER_QUERY_DIRECTIONS) ||
    !Number.isSafeInteger(policy.maxPage) ||
    policy.maxPage < 1 ||
    !Number.isSafeInteger(policy.defaultPage) ||
    policy.defaultPage < 1 ||
    policy.defaultPage > policy.maxPage
  ) {
    throw new TypeError('invalid_customer_query_policy');
  }

  return {
    lifecycle: null,
    priority: null,
    ownerId: null,
    projectId: null,
    tag: null,
    lastTouchedFrom: null,
    lastTouchedTo: null,
    sort: policy.defaultSort,
    direction: policy.defaultDirection,
    page: policy.defaultPage,
  };
}

function safeDefaultResult<TSort extends string>(
  query: CustomerQuery<TSort>,
): CustomerQueryParseResult<TSort> {
  return {
    source: 'safe_default',
    code: 'invalid_customer_query',
    query,
  };
}

export function parseCustomerQuery<TSort extends string>(
  params: URLSearchParams,
  policy: CustomerQueryPolicy<TSort>,
): CustomerQueryParseResult<TSort> {
  const safeDefault = createSafeDefaultQuery(policy);
  const seenKeys = new Set<string>();

  for (const key of params.keys()) {
    if (!allowedParamKeys.has(key) || seenKeys.has(key)) {
      return safeDefaultResult(safeDefault);
    }
    seenKeys.add(key);
  }

  const lifecycleValue = params.get('lifecycle');
  if (
    params.has('lifecycle') &&
    (lifecycleValue === null || !isOneOf(lifecycleValue, CUSTOMER_LIFECYCLES))
  ) {
    return safeDefaultResult(safeDefault);
  }

  const priorityValue = params.get('priority');
  if (
    params.has('priority') &&
    (priorityValue === null || !isOneOf(priorityValue, CUSTOMER_PRIORITIES))
  ) {
    return safeDefaultResult(safeDefault);
  }

  const ownerId = params.get('ownerId');
  if (params.has('ownerId') && (ownerId === null || !policy.allowedOwnerIds.has(ownerId))) {
    return safeDefaultResult(safeDefault);
  }

  const projectId = params.get('projectId');
  if (
    params.has('projectId') &&
    (projectId === null || !policy.allowedProjectIds.has(projectId))
  ) {
    return safeDefaultResult(safeDefault);
  }

  const tag = params.get('tag');
  if (params.has('tag') && (tag === null || !policy.allowedTags.has(tag))) {
    return safeDefaultResult(safeDefault);
  }

  const lastTouchedFrom = params.get('lastTouchedFrom');
  if (
    params.has('lastTouchedFrom') &&
    (lastTouchedFrom === null || !isValidIsoDate(lastTouchedFrom))
  ) {
    return safeDefaultResult(safeDefault);
  }

  const lastTouchedTo = params.get('lastTouchedTo');
  if (
    params.has('lastTouchedTo') &&
    (lastTouchedTo === null || !isValidIsoDate(lastTouchedTo))
  ) {
    return safeDefaultResult(safeDefault);
  }

  if (
    lastTouchedFrom !== null &&
    lastTouchedTo !== null &&
    lastTouchedFrom > lastTouchedTo
  ) {
    return safeDefaultResult(safeDefault);
  }

  const sortValue = params.get('sort');
  if (
    params.has('sort') &&
    (sortValue === null || !policy.allowedSorts.has(sortValue as TSort))
  ) {
    return safeDefaultResult(safeDefault);
  }

  const directionValue = params.get('direction');
  if (
    params.has('direction') &&
    (directionValue === null || !isOneOf(directionValue, CUSTOMER_QUERY_DIRECTIONS))
  ) {
    return safeDefaultResult(safeDefault);
  }

  const pageValue = params.get('page');
  let page = policy.defaultPage;
  if (params.has('page')) {
    if (pageValue === null || !/^\d+$/u.test(pageValue)) {
      return safeDefaultResult(safeDefault);
    }
    page = Number(pageValue);
    if (!Number.isSafeInteger(page) || page < 1 || page > policy.maxPage) {
      return safeDefaultResult(safeDefault);
    }
  }

  return {
    source: 'parsed',
    code: null,
    query: {
      lifecycle: lifecycleValue as CustomerLifecycle | null,
      priority: priorityValue as CustomerPriority | null,
      ownerId,
      projectId,
      tag,
      lastTouchedFrom,
      lastTouchedTo,
      sort: (sortValue ?? policy.defaultSort) as TSort,
      direction: (directionValue ?? policy.defaultDirection) as CustomerQueryDirection,
      page,
    },
  };
}

export function parseCustomerSearchIntent(input: string): CustomerSearchIntentResult {
  const keyword = input.trim();
  if (keyword.length === 0) {
    return { ok: true, intent: null };
  }

  if (!isLowSensitiveCustomerText(keyword)) {
    return { ok: false, code: 'sensitive_customer_search' };
  }

  return {
    ok: true,
    intent: {
      keyword,
      fields: CUSTOMER_SEARCH_FIELDS,
    },
  };
}
