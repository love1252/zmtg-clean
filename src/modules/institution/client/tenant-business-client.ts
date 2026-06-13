import type { AppointmentRecordSummary } from '@/modules/institution/domain/appointment-records';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import type { CustomerTimelineResponse } from '@/modules/institution/domain/customer-timeline';
import type {
  InstitutionKnowledgeItemDto,
  InstitutionKnowledgeListResponse,
} from '@/modules/institution/domain/institution-knowledge-management';
import type {
  FollowUpStatus,
  TenantFollowUpTaskSource,
  TenantFollowUpTask,
} from '@/modules/institution/domain/followup-workflow';
import type { TreatmentFollowUpSuggestion } from '@/modules/institution/domain/treatment-followup-suggestions';
import type {
  CreateTreatmentSummaryDraft,
  CustomerTimelineTreatmentSummary,
  InstitutionTreatmentSummaryListItem,
  TreatmentSummaryListPageInfo,
  UpdateTreatmentSummaryDraft,
  VoidTreatmentSummaryDraft,
} from '@/modules/institution/domain/treatment-summaries';

export type CreateCustomerClientPayload = Omit<CustomerRecordSummary, 'id' | 'tenantId'>;

export type UpdateCustomerClientPayload = Partial<CreateCustomerClientPayload> & {
  id: string;
};

export type CreateAppointmentClientPayload = Pick<
  AppointmentRecordSummary,
  | 'customerId'
  | 'customerDisplayName'
  | 'project'
  | 'scheduledAt'
  | 'consultantUserId'
  | 'status'
  | 'note'
>;

export type UpdateAppointmentClientPayload = Pick<
  AppointmentRecordSummary,
  'id' | 'status' | 'note'
>;

export type FollowUpTransitionClientPayload = {
  id: string;
  nextStatus: FollowUpStatus;
};

export type TreatmentFollowUpTaskConfirmationClientPayload = {
  suggestionKey: string;
};

export type TreatmentFollowUpTaskConfirmationClientRecord = Omit<
  TenantFollowUpTask,
  'tenantId'
> &
  TenantFollowUpTaskSource;

export type CreateTreatmentSummaryClientPayload = Omit<
  CreateTreatmentSummaryDraft,
  'appointmentId'
> & {
  appointmentId?: string | null;
};

export type UpdateTreatmentSummaryClientPayload = Partial<
  Omit<UpdateTreatmentSummaryDraft, 'appointmentId'>
> & {
  appointmentId?: string | null;
};

export type VoidTreatmentSummaryClientPayload = VoidTreatmentSummaryDraft;

export type TreatmentSummaryListClientQuery = {
  customerId?: string | number | null;
  treatmentProject?: string | number | null;
  riskLevel?: string | number | null;
  from?: string | number | null;
  to?: string | number | null;
  limit?: string | number | null;
  cursor?: string | number | null;
};

export type FollowUpTaskListClientQuery = {
  source?: string | number | null;
  sourceTreatmentSummaryId?: string | number | null;
};

export type InstitutionKnowledgeListClientQuery = {
  keyword?: string | number | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

export type TenantBusinessClientErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation_error'
  | 'service_unavailable'
  | 'unknown';

export type TenantBusinessClientError = {
  kind: TenantBusinessClientErrorKind;
  message: string;
  status: number;
};

export type TenantBusinessListResult<T> =
  | { ok: true; records: T[] }
  | { ok: false; error: TenantBusinessClientError };

export type TenantBusinessMutationResult<T> =
  | { ok: true; record: T }
  | { ok: false; error: TenantBusinessClientError };

export type CustomerTimelineClientResult =
  | { ok: true; timeline: CustomerTimelineResponse }
  | { ok: false; error: TenantBusinessClientError };

export type TreatmentSummaryListClientResult =
  | {
      ok: true;
      records: InstitutionTreatmentSummaryListItem[];
      pageInfo: TreatmentSummaryListPageInfo;
    }
  | { ok: false; error: TenantBusinessClientError };

export type TreatmentFollowUpSuggestionListClientResult =
  | { ok: true; suggestions: TreatmentFollowUpSuggestion[] }
  | { ok: false; error: TenantBusinessClientError };

export type InstitutionKnowledgeListClientResult =
  | {
      ok: true;
      records: InstitutionKnowledgeItemDto[];
      pageInfo: InstitutionKnowledgeListResponse['pageInfo'];
    }
  | { ok: false; error: TenantBusinessClientError };

type TenantBusinessClientOptions = {
  fetcher?: typeof fetch;
};

const customerPayloadKeys = [
  'displayName',
  'lifecycle',
  'priority',
  'ownerUserId',
  'projectInterest',
  'maskedPhone',
  'maskedMedicalRecordNo',
  'lastTouchSummary',
  'nextAction',
  'tags',
] as const;

const updateCustomerPayloadKeys = ['id', ...customerPayloadKeys] as const;

const createAppointmentPayloadKeys = [
  'customerId',
  'customerDisplayName',
  'project',
  'scheduledAt',
  'consultantUserId',
  'status',
  'note',
] as const;

const updateAppointmentPayloadKeys = ['id', 'status', 'note'] as const;
const followUpTransitionPayloadKeys = ['id', 'nextStatus'] as const;
const treatmentFollowUpTaskConfirmationPayloadKeys = ['suggestionKey'] as const;
const createTreatmentSummaryPayloadKeys = [
  'treatmentDate',
  'treatmentProject',
  'treatmentCategory',
  'treatmentStage',
  'recoveryStage',
  'riskLevel',
  'ownerUserId',
  'summary',
  'nextCareAction',
  'tags',
  'appointmentId',
] as const;
const updateTreatmentSummaryPayloadKeys = createTreatmentSummaryPayloadKeys;
const voidTreatmentSummaryPayloadKeys = ['reasonCode', 'reasonText'] as const;
const treatmentSummaryListQueryKeys = [
  'customerId',
  'treatmentProject',
  'riskLevel',
  'from',
  'to',
  'limit',
  'cursor',
] as const;
const followUpTaskListQueryKeys = ['source', 'sourceTreatmentSummaryId'] as const;
const institutionKnowledgeListQueryKeys = ['keyword', 'page', 'pageSize'] as const;

function getFetcher(options?: TenantBusinessClientOptions) {
  return options?.fetcher ?? globalThis.fetch;
}

function errorKindFromStatus(status: number): TenantBusinessClientErrorKind {
  if (status === 400) return 'validation_error';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 503) return 'service_unavailable';
  return 'unknown';
}

function isJsonObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

const tenantQuotaClientMessages = {
  missing_active_plan: '当前机构暂无有效套餐，暂不能新增数据，请联系平台管理员。',
  missing_quota_limit: '当前机构套餐配额未配置完整，暂不能新增数据，请联系平台管理员。',
  quota_exceeded_appointments: '当前套餐的预约数量已达上限，请联系平台管理员调整套餐或配额。',
  quota_exceeded_customers: '当前套餐的客户数量已达上限，请联系平台管理员调整套餐或配额。',
} as const;

type TenantQuotaClientReason = keyof typeof tenantQuotaClientMessages;

const tenantQuotaMessagePatterns: Array<{
  message: string;
  patterns: string[];
  reason: TenantQuotaClientReason;
}> = [
  {
    reason: 'quota_exceeded_customers',
    message: tenantQuotaClientMessages.quota_exceeded_customers,
    patterns: ['quota_exceeded_customers', '客户配额已达上限'],
  },
  {
    reason: 'quota_exceeded_appointments',
    message: tenantQuotaClientMessages.quota_exceeded_appointments,
    patterns: ['quota_exceeded_appointments', '预约配额已达上限'],
  },
  {
    reason: 'missing_active_plan',
    message: tenantQuotaClientMessages.missing_active_plan,
    patterns: ['missing_active_plan', '未配置有效套餐', '暂无有效套餐'],
  },
  {
    reason: 'missing_quota_limit',
    message: tenantQuotaClientMessages.missing_quota_limit,
    patterns: ['missing_quota_limit', '套餐配额未配置'],
  },
];

const forbiddenErrorDetailPatterns = [
  /DATABASE_URL/iu,
  /postgres:\/\//iu,
  /\bselect\s+\*/iu,
  /\bsql\b/iu,
  /\bstack\b/iu,
  /\btoken\b/iu,
  /\bsecret\b/iu,
  /sk_(?:live|test)/iu,
  /zmtg_sk_/iu,
];

function firstPayloadString(payload: unknown, keys: readonly string[]) {
  if (!isJsonObject(payload)) return null;

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string') {
      return value;
    }
  }

  return null;
}

function getTenantQuotaClientMessage(payload: unknown, message: string | null) {
  const searchable = [
    message,
    firstPayloadString(payload, ['reason', 'code']),
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  return (
    tenantQuotaMessagePatterns.find(({ patterns }) =>
      patterns.some((pattern) => searchable.includes(pattern)),
    )?.message ?? null
  );
}

function containsForbiddenErrorDetails(message: string) {
  return forbiddenErrorDetailPatterns.some((pattern) => pattern.test(message));
}

function fallbackMessageFromStatus(status: number, fallbackMessage?: string) {
  if (status === 401) return '请先登录';
  if (status === 403) return '没有访问权限';
  if (status === 404) return '记录不存在';
  if (status === 503) return '数据服务暂时不可用';
  return fallbackMessage ?? '请求失败';
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function createClientError(input: {
  status: number;
  payload: unknown;
  fallbackMessage?: string;
}): TenantBusinessClientError {
  const rawMessage =
    isJsonObject(input.payload) && typeof input.payload.error === 'string'
      ? input.payload.error
      : input.fallbackMessage ?? '请求失败';
  const quotaMessage = getTenantQuotaClientMessage(input.payload, rawMessage);
  const message =
    quotaMessage ??
    (containsForbiddenErrorDetails(rawMessage)
      ? fallbackMessageFromStatus(input.status, input.fallbackMessage)
      : rawMessage);

  return {
    kind: errorKindFromStatus(input.status),
    message,
    status: input.status,
  };
}

function pickPayload(
  input: Record<string, unknown>,
  allowedKeys: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    allowedKeys
      .filter((key) => Object.prototype.hasOwnProperty.call(input, key))
      .map((key) => [key, input[key]]),
  );
}

async function requestRecords<T>(
  path: string,
  options?: TenantBusinessClientOptions,
): Promise<TenantBusinessListResult<T>> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher(path, { cache: 'no-store' });
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        error: createClientError({ status: response.status, payload }),
      };
    }

    if (!isJsonObject(payload) || !Array.isArray(payload.records)) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '请求失败', status: response.status },
      };
    }

    return { ok: true, records: payload.records as T[] };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }
}

function buildTreatmentSummaryListPath(query: TreatmentSummaryListClientQuery = {}) {
  const params = new URLSearchParams();

  for (const key of treatmentSummaryListQueryKeys) {
    const value = query[key];
    if (value === undefined || value === null) continue;

    const normalized = String(value).trim();
    if (normalized.length === 0) continue;
    params.set(key, normalized);
  }

  const queryString = params.toString();
  return queryString.length > 0
    ? `/api/institution/treatment-summaries?${queryString}`
    : '/api/institution/treatment-summaries';
}

function buildFollowUpTaskListPath(query: FollowUpTaskListClientQuery = {}) {
  const params = new URLSearchParams();

  for (const key of followUpTaskListQueryKeys) {
    const value = query[key];
    if (value === undefined || value === null) continue;

    const normalized = String(value).trim();
    if (normalized.length === 0) continue;
    if (key === 'source' && normalized !== 'treatment_summary') continue;

    params.set(key, normalized);
  }

  const queryString = params.toString();
  return queryString.length > 0
    ? `/api/institution/followups?${queryString}`
    : '/api/institution/followups';
}

function buildInstitutionKnowledgeListPath(query: InstitutionKnowledgeListClientQuery = {}) {
  const params = new URLSearchParams();

  for (const key of institutionKnowledgeListQueryKeys) {
    const value = query[key];
    if (value === undefined || value === null) continue;

    const normalized = String(value).trim();
    if (normalized.length === 0) continue;
    params.set(key, normalized);
  }

  const queryString = params.toString();
  return queryString.length > 0
    ? `/api/institution/knowledge-management/items?${queryString}`
    : '/api/institution/knowledge-management/items';
}

function isTreatmentSummaryListPageInfo(input: unknown): input is TreatmentSummaryListPageInfo {
  return (
    isJsonObject(input) &&
    typeof input.hasMore === 'boolean' &&
    typeof input.limit === 'number' &&
    (typeof input.nextCursor === 'string' || input.nextCursor === null)
  );
}

function isInstitutionKnowledgePageInfo(
  input: unknown,
): input is InstitutionKnowledgeListResponse['pageInfo'] {
  return (
    isJsonObject(input) &&
    typeof input.page === 'number' &&
    typeof input.pageSize === 'number' &&
    typeof input.total === 'number' &&
    typeof input.pageCount === 'number' &&
    typeof input.hasPreviousPage === 'boolean' &&
    typeof input.hasNextPage === 'boolean'
  );
}

export async function listTreatmentSummaries(
  query?: TreatmentSummaryListClientQuery,
  options?: TenantBusinessClientOptions,
): Promise<TreatmentSummaryListClientResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher(buildTreatmentSummaryListPath(query), {
      cache: 'no-store',
    });
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        error: createClientError({ status: response.status, payload }),
      };
    }

    if (
      !isJsonObject(payload) ||
      !Array.isArray(payload.records) ||
      !isTreatmentSummaryListPageInfo(payload.pageInfo)
    ) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '请求失败', status: response.status },
      };
    }

    return {
      ok: true,
      records: payload.records as InstitutionTreatmentSummaryListItem[],
      pageInfo: payload.pageInfo,
    };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }
}

export async function listInstitutionKnowledgeItems(
  query?: InstitutionKnowledgeListClientQuery,
  options?: TenantBusinessClientOptions,
): Promise<InstitutionKnowledgeListClientResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher(buildInstitutionKnowledgeListPath(query), {
      cache: 'no-store',
    });
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        error: createClientError({ status: response.status, payload }),
      };
    }

    if (
      !isJsonObject(payload) ||
      !Array.isArray(payload.records) ||
      !isInstitutionKnowledgePageInfo(payload.pageInfo)
    ) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '请求失败', status: response.status },
      };
    }

    return {
      ok: true,
      records: payload.records as InstitutionKnowledgeItemDto[],
      pageInfo: payload.pageInfo,
    };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }
}

export async function listTreatmentFollowUpSuggestions(
  summaryId: string,
  options?: TenantBusinessClientOptions,
): Promise<TreatmentFollowUpSuggestionListClientResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher(
      `/api/institution/treatment-summaries/${encodeURIComponent(summaryId)}/follow-up-suggestions`,
      { cache: 'no-store' },
    );
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        error: createClientError({ status: response.status, payload }),
      };
    }

    if (!isJsonObject(payload) || !Array.isArray(payload.suggestions)) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '请求失败', status: response.status },
      };
    }

    return {
      ok: true,
      suggestions: payload.suggestions as TreatmentFollowUpSuggestion[],
    };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }
}

async function requestRecord<T>(
  path: string,
  method: 'POST' | 'PATCH',
  payload: Record<string, unknown>,
  options?: TenantBusinessClientOptions,
): Promise<TenantBusinessMutationResult<T>> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const responsePayload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        error: createClientError({ status: response.status, payload: responsePayload }),
      };
    }

    if (!isJsonObject(responsePayload) || !isJsonObject(responsePayload.record)) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '请求失败', status: response.status },
      };
    }

    return { ok: true, record: responsePayload.record as T };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }
}

export function listCustomers(options?: TenantBusinessClientOptions) {
  return requestRecords<CustomerRecordSummary>('/api/institution/customers', options);
}

export async function getCustomerTimeline(
  customerId: string,
  options?: TenantBusinessClientOptions,
): Promise<CustomerTimelineClientResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher(
      `/api/institution/customers/${encodeURIComponent(customerId)}/timeline`,
      { cache: 'no-store' },
    );
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        error: createClientError({ status: response.status, payload }),
      };
    }

    if (
      !isJsonObject(payload) ||
      !isJsonObject(payload.customer) ||
      !Array.isArray(payload.appointments) ||
      !Array.isArray(payload.followups) ||
      !Array.isArray(payload.auditEvents) ||
      !Array.isArray(payload.timeline)
    ) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '请求失败', status: response.status },
      };
    }

    return { ok: true, timeline: payload as CustomerTimelineResponse };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }
}

export function createCustomer(
  payload: CreateCustomerClientPayload,
  options?: TenantBusinessClientOptions,
) {
  return requestRecord<CustomerRecordSummary>(
    '/api/institution/customers',
    'POST',
    pickPayload(payload as unknown as Record<string, unknown>, customerPayloadKeys),
    options,
  );
}

export function updateCustomer(
  payload: UpdateCustomerClientPayload,
  options?: TenantBusinessClientOptions,
) {
  return requestRecord<CustomerRecordSummary>(
    '/api/institution/customers',
    'PATCH',
    pickPayload(payload as unknown as Record<string, unknown>, updateCustomerPayloadKeys),
    options,
  );
}

export function listAppointments(options?: TenantBusinessClientOptions) {
  return requestRecords<AppointmentRecordSummary>('/api/institution/appointments', options);
}

export function createAppointment(
  payload: CreateAppointmentClientPayload,
  options?: TenantBusinessClientOptions,
) {
  return requestRecord<AppointmentRecordSummary>(
    '/api/institution/appointments',
    'POST',
    pickPayload(payload as unknown as Record<string, unknown>, createAppointmentPayloadKeys),
    options,
  );
}

export function updateAppointment(
  payload: UpdateAppointmentClientPayload,
  options?: TenantBusinessClientOptions,
) {
  return requestRecord<AppointmentRecordSummary>(
    '/api/institution/appointments',
    'PATCH',
    pickPayload(payload as unknown as Record<string, unknown>, updateAppointmentPayloadKeys),
    options,
  );
}

export function createTreatmentSummary(
  customerId: string,
  payload: CreateTreatmentSummaryClientPayload,
  options?: TenantBusinessClientOptions,
) {
  return requestRecord<CustomerTimelineTreatmentSummary>(
    `/api/institution/customers/${encodeURIComponent(customerId)}/treatment-summaries`,
    'POST',
    pickPayload(
      payload as unknown as Record<string, unknown>,
      createTreatmentSummaryPayloadKeys,
    ),
    options,
  );
}

export function updateTreatmentSummary(
  summaryId: string,
  payload: UpdateTreatmentSummaryClientPayload,
  options?: TenantBusinessClientOptions,
) {
  return requestRecord<CustomerTimelineTreatmentSummary>(
    `/api/institution/treatment-summaries/${encodeURIComponent(summaryId)}`,
    'PATCH',
    pickPayload(
      payload as unknown as Record<string, unknown>,
      updateTreatmentSummaryPayloadKeys,
    ),
    options,
  );
}

export function voidTreatmentSummary(
  summaryId: string,
  payload: VoidTreatmentSummaryClientPayload,
  options?: TenantBusinessClientOptions,
) {
  return requestRecord<Omit<InstitutionTreatmentSummaryListItem, 'customerId'>>(
    `/api/institution/treatment-summaries/${encodeURIComponent(summaryId)}/void`,
    'POST',
    pickPayload(
      payload as unknown as Record<string, unknown>,
      voidTreatmentSummaryPayloadKeys,
    ),
    options,
  );
}

export function listFollowUpTasks(options?: TenantBusinessClientOptions): Promise<TenantBusinessListResult<TenantFollowUpTask>>;
export function listFollowUpTasks(
  query?: FollowUpTaskListClientQuery,
  options?: TenantBusinessClientOptions,
): Promise<TenantBusinessListResult<TenantFollowUpTask>>;
export function listFollowUpTasks(
  queryOrOptions?: FollowUpTaskListClientQuery | TenantBusinessClientOptions,
  options?: TenantBusinessClientOptions,
) {
  const firstArgIsOptions =
    isJsonObject(queryOrOptions) &&
    Object.prototype.hasOwnProperty.call(queryOrOptions, 'fetcher') &&
    options === undefined;
  const query = firstArgIsOptions
    ? undefined
    : (queryOrOptions as FollowUpTaskListClientQuery | undefined);
  const clientOptions = firstArgIsOptions
    ? (queryOrOptions as TenantBusinessClientOptions)
    : options;

  return requestRecords<TenantFollowUpTask>(buildFollowUpTaskListPath(query), clientOptions);
}

export function transitionFollowUpTask(
  payload: FollowUpTransitionClientPayload,
  options?: TenantBusinessClientOptions,
) {
  return requestRecord<TenantFollowUpTask>(
    '/api/institution/followups',
    'PATCH',
    pickPayload(payload as unknown as Record<string, unknown>, followUpTransitionPayloadKeys),
    options,
  );
}

export function createFollowUpTaskFromTreatmentSummary(
  summaryId: string,
  payload: TreatmentFollowUpTaskConfirmationClientPayload,
  options?: TenantBusinessClientOptions,
) {
  return requestRecord<TreatmentFollowUpTaskConfirmationClientRecord>(
    `/api/institution/treatment-summaries/${encodeURIComponent(summaryId)}/follow-up-tasks`,
    'POST',
    pickPayload(
      payload as unknown as Record<string, unknown>,
      treatmentFollowUpTaskConfirmationPayloadKeys,
    ),
    options,
  );
}
