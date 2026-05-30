import type { AppointmentRecordSummary } from '@/modules/institution/domain/appointment-records';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import type {
  FollowUpStatus,
  TenantFollowUpTask,
} from '@/modules/institution/domain/followup-workflow';

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
  const message =
    isJsonObject(input.payload) && typeof input.payload.error === 'string'
      ? input.payload.error
      : input.fallbackMessage ?? '请求失败';

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

export function listFollowUpTasks(options?: TenantBusinessClientOptions) {
  return requestRecords<TenantFollowUpTask>('/api/institution/followups', options);
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
