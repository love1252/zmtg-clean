import {
  weComCustomerMappingProof,
  weComCustomerMappingStatuses,
  type PersistedWeComCustomerMappingStatus,
  type WeComCustomerMappingAction,
  type WeComCustomerMappingStatus,
} from '@/modules/institution/domain/wecom-customer-mapping';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';

export type WeComCustomerMappingCandidate = {
  customerId: string;
  displayName: string;
  maskedPhone: string;
  maskedMedicalRecordNo: string;
  lifecycle: CustomerRecordSummary['lifecycle'];
  priority: CustomerRecordSummary['priority'];
};

export type WeComCustomerMappingSummary = {
  proofContactId: typeof weComCustomerMappingProof.proofContactId;
  proofEmployeeId: typeof weComCustomerMappingProof.proofEmployeeId;
  sourceMode: typeof weComCustomerMappingProof.sourceMode;
  status: WeComCustomerMappingStatus;
  customerId: string | null;
};

export type WeComCustomerMappingReadResponse = {
  mapping: WeComCustomerMappingSummary;
  candidates: WeComCustomerMappingCandidate[];
  currentCustomer: WeComCustomerMappingCandidate | null;
  canWrite: boolean;
};

export type WeComCustomerMappingWriteResponse = {
  outcome: 'updated' | 'idempotent';
  mapping: WeComCustomerMappingSummary & {
    status: PersistedWeComCustomerMappingStatus;
  };
};

export type WeComCustomerMappingClientError = {
  status: number;
  code: string | null;
  message: string;
};

export type WeComCustomerMappingClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: WeComCustomerMappingClientError };

type MappingFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type MappingClientOptions = {
  fetcher?: MappingFetcher;
};

function getFetcher(options?: MappingClientOptions): MappingFetcher | null {
  if (options?.fetcher) return options.fetcher;
  if (typeof globalThis.fetch !== 'function') return null;
  return globalThis.fetch.bind(globalThis);
}

function isJsonObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function createError(status: number, payload: unknown): WeComCustomerMappingClientError {
  if (!isJsonObject(payload)) {
    return { status, code: null, message: '请求失败' };
  }
  return {
    status,
    code: typeof payload.code === 'string' ? payload.code : null,
    message: typeof payload.error === 'string' ? payload.error : '请求失败',
  };
}

function parseCandidate(input: unknown): WeComCustomerMappingCandidate | null {
  if (!isJsonObject(input)) return null;
  const fields = [
    'customerId',
    'displayName',
    'maskedPhone',
    'maskedMedicalRecordNo',
    'lifecycle',
    'priority',
  ] as const;
  if (!fields.every((field) => typeof input[field] === 'string')) return null;
  return {
    customerId: input.customerId as string,
    displayName: input.displayName as string,
    maskedPhone: input.maskedPhone as string,
    maskedMedicalRecordNo: input.maskedMedicalRecordNo as string,
    lifecycle: input.lifecycle as CustomerRecordSummary['lifecycle'],
    priority: input.priority as CustomerRecordSummary['priority'],
  };
}

function parseSummary(
  input: unknown,
  persistedOnly: boolean,
): WeComCustomerMappingSummary | null {
  if (!isJsonObject(input)) return null;
  if (
    input.proofContactId !== weComCustomerMappingProof.proofContactId ||
    input.proofEmployeeId !== weComCustomerMappingProof.proofEmployeeId ||
    input.sourceMode !== weComCustomerMappingProof.sourceMode ||
    !weComCustomerMappingStatuses.includes(input.status as WeComCustomerMappingStatus) ||
    (persistedOnly && input.status === 'unreviewed') ||
    (typeof input.customerId !== 'string' && input.customerId !== null)
  ) {
    return null;
  }
  return {
    ...weComCustomerMappingProof,
    status: input.status as WeComCustomerMappingStatus,
    customerId: input.customerId,
  };
}

function parseReadResponse(input: unknown): WeComCustomerMappingReadResponse | null {
  if (!isJsonObject(input) || !Array.isArray(input.candidates)) return null;
  const mapping = parseSummary(input.mapping, false);
  const candidates = input.candidates.map(parseCandidate);
  const currentCustomer = input.currentCustomer === null ? null : parseCandidate(input.currentCustomer);
  if (
    !mapping ||
    candidates.some((candidate) => candidate === null) ||
    (input.currentCustomer !== null && !currentCustomer) ||
    typeof input.canWrite !== 'boolean'
  ) {
    return null;
  }
  return {
    mapping,
    candidates: candidates as WeComCustomerMappingCandidate[],
    currentCustomer,
    canWrite: input.canWrite,
  };
}

function parseWriteResponse(input: unknown): WeComCustomerMappingWriteResponse | null {
  if (!isJsonObject(input) || (input.outcome !== 'updated' && input.outcome !== 'idempotent')) {
    return null;
  }
  const mapping = parseSummary(input.mapping, true);
  if (!mapping || mapping.status === 'unreviewed') return null;
  return {
    outcome: input.outcome,
    mapping: {
      ...mapping,
      status: mapping.status,
    },
  };
}

export async function getWeComCustomerMapping(
  options?: MappingClientOptions,
): Promise<WeComCustomerMappingClientResult<WeComCustomerMappingReadResponse>> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return { ok: false, error: { status: 0, code: null, message: '请求失败' } };
  }
  try {
    const response = await fetcher('/api/institution/wecom-customer-mapping', {
      method: 'GET',
      cache: 'no-store',
    });
    const payload = await readJson(response);
    if (!response.ok) return { ok: false, error: createError(response.status, payload) };
    const data = parseReadResponse(payload);
    return data
      ? { ok: true, data }
      : { ok: false, error: { status: response.status, code: null, message: '响应格式不正确' } };
  } catch {
    return { ok: false, error: { status: 0, code: null, message: '请求失败' } };
  }
}

export async function updateWeComCustomerMapping(
  input: { action: WeComCustomerMappingAction; customerId: string },
  options?: MappingClientOptions,
): Promise<WeComCustomerMappingClientResult<WeComCustomerMappingWriteResponse>> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return { ok: false, error: { status: 0, code: null, message: '请求失败' } };
  }
  try {
    const response = await fetcher('/api/institution/wecom-customer-mapping', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: input.action,
        proofContactId: weComCustomerMappingProof.proofContactId,
        customerId: input.customerId,
      }),
    });
    const payload = await readJson(response);
    if (!response.ok) return { ok: false, error: createError(response.status, payload) };
    const data = parseWriteResponse(payload);
    return data
      ? { ok: true, data }
      : { ok: false, error: { status: response.status, code: null, message: '响应格式不正确' } };
  } catch {
    return { ok: false, error: { status: 0, code: null, message: '请求失败' } };
  }
}
