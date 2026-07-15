import type {
  WeComCustomerMappingReviewAction,
  WeComCustomerMappingReviewActionCommand,
  WeComCustomerMappingReviewReasonCode,
  WeComCustomerMappingReviewState,
} from '@/modules/institution/domain/wecom-customer-mapping-review-actions';

export type {
  WeComCustomerMappingReviewAction,
  WeComCustomerMappingReviewReasonCode,
  WeComCustomerMappingReviewState,
} from '@/modules/institution/domain/wecom-customer-mapping-review-actions';

export const weComCustomerMappingReviewActions = [
  'approve_candidate',
  'reject_candidate',
  'request_more_info',
  'mark_conflict',
  'reopen_review',
] as const satisfies readonly WeComCustomerMappingReviewAction[];

export const weComCustomerMappingReviewStates = [
  'pending_review',
  'needs_more_info',
  'conflict',
  'approved_pending_link',
  'rejected',
  'reopened',
  'disabled',
] as const satisfies readonly WeComCustomerMappingReviewState[];

export const weComCustomerMappingReviewActionLabels: Record<
  WeComCustomerMappingReviewAction,
  string
> = {
  approve_candidate: '确认候选',
  reject_candidate: '拒绝候选',
  request_more_info: '补充信息',
  mark_conflict: '标记冲突',
  reopen_review: '重新打开',
};

export const weComCustomerMappingReviewReasonOptions: Record<
  WeComCustomerMappingReviewAction,
  readonly Readonly<{ value: WeComCustomerMappingReviewReasonCode; label: string }>[]
> = {
  approve_candidate: [
    { value: 'manual_evidence_confirmed', label: '人工依据已确认' },
    { value: 'institution_record_match_confirmed', label: '机构记录匹配已确认' },
  ],
  reject_candidate: [
    { value: 'evidence_not_sufficient', label: '现有依据不足' },
    { value: 'candidate_not_same_person', label: '确认不是同一客户' },
    { value: 'candidate_outdated', label: '候选信息已过期' },
  ],
  request_more_info: [
    { value: 'missing_low_sensitive_evidence', label: '缺少低敏核验依据' },
    { value: 'ownership_or_source_unclear', label: '归属或来源不清晰' },
  ],
  mark_conflict: [
    { value: 'multiple_candidate_conflict', label: '存在多个候选冲突' },
    { value: 'identity_evidence_conflict', label: '身份依据存在冲突' },
    { value: 'ownership_conflict', label: '客户归属存在冲突' },
  ],
  reopen_review: [
    { value: 'new_low_sensitive_evidence', label: '出现新的低敏依据' },
    { value: 'prior_decision_reconsidered', label: '需要重新评估原结论' },
    { value: 'version_reconciliation', label: '需要重新核对版本' },
  ],
};

const availableActionsByState: Record<
  WeComCustomerMappingReviewState,
  readonly WeComCustomerMappingReviewAction[]
> = {
  pending_review: [
    'approve_candidate',
    'reject_candidate',
    'request_more_info',
    'mark_conflict',
  ],
  needs_more_info: ['approve_candidate', 'reject_candidate', 'mark_conflict'],
  conflict: ['reject_candidate', 'request_more_info', 'reopen_review'],
  approved_pending_link: ['reopen_review'],
  rejected: ['reopen_review'],
  reopened: [
    'approve_candidate',
    'reject_candidate',
    'request_more_info',
    'mark_conflict',
  ],
  disabled: [],
};

const nextStateByAction: Record<
  WeComCustomerMappingReviewAction,
  WeComCustomerMappingReviewState
> = {
  approve_candidate: 'approved_pending_link',
  reject_candidate: 'rejected',
  request_more_info: 'needs_more_info',
  mark_conflict: 'conflict',
  reopen_review: 'reopened',
};

const responseKeys = [
  'ok',
  'mappingId',
  'action',
  'previousStatus',
  'nextStatus',
  'previousVersion',
  'nextVersion',
  'reasonCode',
  'idempotentReplay',
  'auditSummary',
  'mockDemo',
  'persistenceMode',
  'autoMergePerformed',
  'realCustomerRelationshipWritten',
] as const;
const auditSummaryKeys = ['eventCount', 'acceptedMutationCount', 'replayCount'] as const;
const errorKeys = ['code'] as const;
const mappingIdPattern = /^[A-Za-z0-9_-]{1,64}$/;
const idempotencyKeyPattern = /^[A-Za-z0-9_-]{16,128}$/;

const knownErrorCodes = new Set([
  'unauthenticated',
  'permission_denied',
  'tenant_context_missing',
  'tenant_mismatch',
  'mapping_unavailable',
  'request_contract_invalid',
  'sensitive_input_blocked',
  'action_not_allowed',
  'version_conflict',
  'idempotency_key_invalid',
  'idempotency_conflict',
  'idempotency_in_progress',
  'idempotency_record_invalid',
  'idempotency_unavailable',
  'audit_unavailable',
  'transaction_failed',
  'response_contract_invalid',
  'unsupported_media_type',
  'request_body_too_large',
  'request_body_length_invalid',
  'request_body_length_mismatch',
  'request_body_encoding_invalid',
  'csrf_validation_failed',
  'mock_runtime_capacity_exceeded',
]);

export type WeComCustomerMappingReviewActionResponse = Readonly<{
  ok: true;
  mappingId: string;
  action: WeComCustomerMappingReviewAction;
  previousStatus: WeComCustomerMappingReviewState;
  nextStatus: WeComCustomerMappingReviewState;
  previousVersion: number;
  nextVersion: number;
  reasonCode: WeComCustomerMappingReviewReasonCode;
  idempotentReplay: boolean;
  auditSummary: Readonly<{
    eventCount: number;
    acceptedMutationCount: 0 | 1;
    replayCount: 0 | 1;
  }>;
  mockDemo: true;
  persistenceMode: 'volatile_process_memory';
  autoMergePerformed: false;
  realCustomerRelationshipWritten: false;
}>;

export type WeComCustomerMappingReviewClientErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'refresh_required'
  | 'in_progress'
  | 'attempt_conflict'
  | 'origin_invalid'
  | 'invalid_note'
  | 'invalid_request'
  | 'unavailable'
  | 'network'
  | 'aborted'
  | 'invalid_response';

export type WeComCustomerMappingReviewClientResult =
  | { ok: true; data: WeComCustomerMappingReviewActionResponse }
  | {
      ok: false;
      error: {
        status: number;
        code: string | null;
        kind: WeComCustomerMappingReviewClientErrorKind;
      };
    };

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type SubmitInput = WeComCustomerMappingReviewActionCommand;

type SubmitOptions = Readonly<{
  fetcher?: Fetcher;
  signal?: AbortSignal;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}

function isOneOf<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function reasonBelongsToAction(
  action: WeComCustomerMappingReviewAction,
  reasonCode: unknown,
): reasonCode is WeComCustomerMappingReviewReasonCode {
  return typeof reasonCode === 'string'
    && weComCustomerMappingReviewReasonOptions[action].some(({ value }) => value === reasonCode);
}

function parseSuccess(
  value: unknown,
  input: SubmitInput,
): WeComCustomerMappingReviewActionResponse | null {
  if (!isRecord(value) || !hasExactKeys(value, responseKeys)) return null;
  const auditSummary = value.auditSummary;
  if (!isRecord(auditSummary) || !hasExactKeys(auditSummary, auditSummaryKeys)) return null;
  if (
    value.ok !== true
    || value.mappingId !== input.mappingId
    || value.action !== input.action
    || !isOneOf(value.previousStatus, weComCustomerMappingReviewStates)
    || value.nextStatus !== nextStateByAction[input.action]
    || !isNonNegativeInteger(value.previousVersion)
    || value.previousVersion !== input.expectedVersion
    || !isNonNegativeInteger(value.nextVersion)
    || value.nextVersion !== value.previousVersion + 1
    || value.reasonCode !== input.reasonCode
    || typeof value.idempotentReplay !== 'boolean'
    || value.mockDemo !== true
    || value.persistenceMode !== 'volatile_process_memory'
    || value.autoMergePerformed !== false
    || value.realCustomerRelationshipWritten !== false
    || !isNonNegativeInteger(auditSummary.eventCount)
    || auditSummary.eventCount === 0
    || (auditSummary.acceptedMutationCount !== 0 && auditSummary.acceptedMutationCount !== 1)
    || (auditSummary.replayCount !== 0 && auditSummary.replayCount !== 1)
    || (value.idempotentReplay
      ? auditSummary.acceptedMutationCount !== 0 || auditSummary.replayCount !== 1
      : auditSummary.acceptedMutationCount !== 1 || auditSummary.replayCount !== 0)
  ) {
    return null;
  }
  return value as WeComCustomerMappingReviewActionResponse;
}

function parseErrorCode(value: unknown): string | null {
  if (!isRecord(value) || !hasExactKeys(value, errorKeys)) return null;
  return typeof value.code === 'string' && knownErrorCodes.has(value.code) ? value.code : null;
}

function errorKind(
  status: number,
  code: string | null,
): WeComCustomerMappingReviewClientErrorKind {
  if (status === 401 || code === 'unauthenticated') return 'unauthenticated';
  if (
    status === 403
    && code !== 'csrf_validation_failed'
  ) return 'forbidden';
  if (code === 'csrf_validation_failed') return 'origin_invalid';
  if (
    code === 'mapping_unavailable'
    || code === 'version_conflict'
    || code === 'action_not_allowed'
    || code === 'idempotency_record_invalid'
  ) return 'refresh_required';
  if (code === 'idempotency_in_progress') return 'in_progress';
  if (code === 'idempotency_conflict') return 'attempt_conflict';
  if (code === 'sensitive_input_blocked') return 'invalid_note';
  if (status >= 500) return 'unavailable';
  return 'invalid_request';
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function validInput(input: SubmitInput) {
  return mappingIdPattern.test(input.mappingId)
    && weComCustomerMappingReviewActions.includes(input.action)
    && isNonNegativeInteger(input.expectedVersion)
    && idempotencyKeyPattern.test(input.idempotencyKey)
    && reasonBelongsToAction(input.action, input.reasonCode)
    && (input.note === undefined || [...input.note].length <= 512);
}

export function getAvailableWeComCustomerMappingReviewActions(
  state: WeComCustomerMappingReviewState | null,
): readonly WeComCustomerMappingReviewAction[] {
  return state ? availableActionsByState[state] : [];
}

export function isWeComCustomerMappingReviewNoteRequired(
  action: WeComCustomerMappingReviewAction,
  reasonCode: WeComCustomerMappingReviewReasonCode,
) {
  return action === 'request_more_info'
    || action === 'mark_conflict'
    || action === 'reopen_review'
    || reasonCode === 'candidate_not_same_person';
}

export function createWeComCustomerMappingReviewIdempotencyKey() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `review_${uuid}`;
  const fallback = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  return `review_${fallback.padEnd(24, '0').slice(0, 80)}`;
}

export async function submitWeComCustomerMappingReviewAction(
  input: SubmitInput,
  options: SubmitOptions = {},
): Promise<WeComCustomerMappingReviewClientResult> {
  if (!validInput(input)) {
    return {
      ok: false,
      error: { status: 0, code: 'request_contract_invalid', kind: 'invalid_request' },
    };
  }

  const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis);
  if (!fetcher) {
    return { ok: false, error: { status: 0, code: null, kind: 'network' } };
  }

  try {
    const response = await fetcher(
      `/api/institution/wecom/customer-mapping-reviews/${encodeURIComponent(input.mappingId)}/actions`,
      {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: input.action,
          expectedVersion: input.expectedVersion,
          idempotencyKey: input.idempotencyKey,
          reasonCode: input.reasonCode,
          ...(input.note === undefined ? {} : { note: input.note }),
        }),
        signal: options.signal,
      },
    );
    const payload = await readJson(response);
    if (!response.ok) {
      const code = parseErrorCode(payload);
      return {
        ok: false,
        error: { status: response.status, code, kind: errorKind(response.status, code) },
      };
    }
    const data = parseSuccess(payload, input);
    return data
      ? { ok: true, data }
      : { ok: false, error: { status: response.status, code: null, kind: 'invalid_response' } };
  } catch (error) {
    if (options.signal?.aborted || (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError')) {
      return { ok: false, error: { status: 0, code: null, kind: 'aborted' } };
    }
    return { ok: false, error: { status: 0, code: null, kind: 'network' } };
  }
}
