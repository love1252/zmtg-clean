import {
  listOpenPlatformAuditEvents,
  type OpenPlatformAuditEventsClientErrorKind,
} from '@/modules/audit/client/open-platform-audit-events-client';
import {
  buildPlatformCommercialHealthViewModel,
  type PlatformCommercialHealthViewModel,
} from '@/modules/open-platform/domain/platform-commercial-health';
import type { TenantManagementListItem } from '@/modules/open-platform/domain/tenant-management';
import type {
  TenantPlanChangePayload,
  TenantPlanChangePreview,
} from '@/modules/open-platform/domain/commercial_entitlement/tenant-plan-change';
import type { TenantCommercialRecordDto } from '@/modules/open-platform/domain/tenant-commercial-records';
import type { TenantPlanOptionDto } from '@/modules/open-platform/domain/tenant-plan-binding';

export type OpenPlatformTenantRecord = TenantManagementListItem;

export type OpenPlatformTenantClientErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'validation_error'
  | 'not_found'
  | 'service_unavailable'
  | 'unknown';

export type OpenPlatformTenantClientError = {
  kind: OpenPlatformTenantClientErrorKind;
  message: string;
  status: number;
};

export type OpenPlatformTenantListResult =
  | { ok: true; records: OpenPlatformTenantRecord[] }
  | { ok: false; error: OpenPlatformTenantClientError };

export type OpenPlatformTenantPlanOptionsResult =
  | { ok: true; options: TenantPlanOptionDto[] }
  | { ok: false; error: OpenPlatformTenantClientError };

export type OpenPlatformTenantCreateResult =
  | { ok: true; status: 'tenant_created'; tenant: OpenPlatformTenantRecord }
  | { ok: false; error: OpenPlatformTenantClientError };

export type OpenPlatformTenantPlanChangePreviewResult =
  | { ok: true; status: 'preview_ready'; preview: TenantPlanChangePreview }
  | { ok: false; error: OpenPlatformTenantClientError };

export type OpenPlatformTenantPlanChangeApplyResult =
  | {
      ok: true;
      status: 'plan_changed';
      changeRecordId: string;
      auditEventId: string;
      tenant: OpenPlatformTenantRecord;
    }
  | { ok: false; error: OpenPlatformTenantClientError };

export type OpenPlatformTenantCommercialRecordsResult =
  | { ok: true; records: TenantCommercialRecordDto[] }
  | { ok: false; error: OpenPlatformTenantClientError };

export type CreateOpenPlatformTenantInput = {
  organizationName: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  adminName?: string;
  adminAccount?: string;
  adminContact?: string;
  initialPassword?: string;
  planVersionId: string;
  reason: string;
};

export type OpenPlatformTenantClientOptions = {
  fetcher?: typeof fetch;
};

export type OpenPlatformCommercialHealthClientOptions = OpenPlatformTenantClientOptions & {
  now?: Date | string;
};

export type OpenPlatformCommercialHealthClientError = {
  kind: OpenPlatformTenantClientErrorKind | OpenPlatformAuditEventsClientErrorKind;
  message: string;
  status: number;
};

export type OpenPlatformCommercialHealthClientResult =
  | { ok: true; health: PlatformCommercialHealthViewModel }
  | { ok: false; error: OpenPlatformCommercialHealthClientError };

function getFetcher(options?: OpenPlatformTenantClientOptions) {
  return options?.fetcher ?? globalThis.fetch;
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

function errorKindFromStatus(status: number): OpenPlatformTenantClientErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 400) return 'validation_error';
  if (status === 404) return 'not_found';
  if (status === 503) return 'service_unavailable';
  return 'unknown';
}

function createClientError(input: {
  status: number;
  payload: unknown;
  fallbackMessage?: string;
}): OpenPlatformTenantClientError {
  const message =
    isJsonObject(input.payload) && Array.isArray(input.payload.errors)
      ? input.payload.errors.filter((error): error is string => typeof error === 'string')[0]
      : isJsonObject(input.payload) && typeof input.payload.error === 'string'
        ? input.payload.error
        : isJsonObject(input.payload) && typeof input.payload.errorCode === 'string'
          ? input.payload.errorCode
          : input.fallbackMessage ?? '请求失败';

  return {
    kind: errorKindFromStatus(input.status),
    message,
    status: input.status,
  };
}

export async function listOpenPlatformTenantPlanOptions(
  options?: OpenPlatformTenantClientOptions,
): Promise<OpenPlatformTenantPlanOptionsResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher('/api/v1/open-platform/tenant-plan-options', {
      cache: 'no-store',
    });
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        error: createClientError({ status: response.status, payload }),
      };
    }

    if (!isJsonObject(payload) || !Array.isArray(payload.options)) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '请求失败', status: response.status },
      };
    }

    return { ok: true, options: payload.options as TenantPlanOptionDto[] };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }
}

export async function createOpenPlatformTenantWithPlan(
  input: CreateOpenPlatformTenantInput,
  options?: OpenPlatformTenantClientOptions,
): Promise<OpenPlatformTenantCreateResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher('/api/v1/open-platform/tenants', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
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
      payload.status !== 'tenant_created' ||
      !isJsonObject(payload.tenant)
    ) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '请求失败', status: response.status },
      };
    }

    return {
      ok: true,
      status: 'tenant_created',
      tenant: payload.tenant as OpenPlatformTenantRecord,
    };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }
}

export async function previewOpenPlatformTenantPlanChange(
  tenantId: string,
  input: TenantPlanChangePayload,
  options?: OpenPlatformTenantClientOptions,
): Promise<OpenPlatformTenantPlanChangePreviewResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher(
      `/api/v1/open-platform/tenants/${encodeURIComponent(tenantId)}/plan-change-preview`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
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
      payload.status !== 'preview_ready' ||
      !isJsonObject(payload.preview)
    ) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '请求失败', status: response.status },
      };
    }

    return {
      ok: true,
      status: 'preview_ready',
      preview: payload.preview as TenantPlanChangePreview,
    };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }
}

export async function applyOpenPlatformTenantPlanChange(
  tenantId: string,
  input: TenantPlanChangePayload,
  options?: OpenPlatformTenantClientOptions,
): Promise<OpenPlatformTenantPlanChangeApplyResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher(
      `/api/v1/open-platform/tenants/${encodeURIComponent(tenantId)}/plan-change`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
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
      payload.status !== 'plan_changed' ||
      typeof payload.changeRecordId !== 'string' ||
      typeof payload.auditEventId !== 'string' ||
      !isJsonObject(payload.tenant)
    ) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '请求失败', status: response.status },
      };
    }

    return {
      ok: true,
      status: 'plan_changed',
      changeRecordId: payload.changeRecordId,
      auditEventId: payload.auditEventId,
      tenant: payload.tenant as OpenPlatformTenantRecord,
    };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }
}

export async function listOpenPlatformTenantCommercialRecords(
  tenantId: string,
  options?: OpenPlatformTenantClientOptions,
): Promise<OpenPlatformTenantCommercialRecordsResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher(
      `/api/v1/open-platform/tenants/${encodeURIComponent(tenantId)}/commercial-records`,
      { cache: 'no-store' },
    );
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

    return { ok: true, records: payload.records as TenantCommercialRecordDto[] };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }
}

export async function listOpenPlatformTenants(
  options?: OpenPlatformTenantClientOptions,
): Promise<OpenPlatformTenantListResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher('/api/open-platform/tenants', { cache: 'no-store' });
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

    return { ok: true, records: payload.records as OpenPlatformTenantRecord[] };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }
}

export async function getOpenPlatformCommercialHealth(
  options?: OpenPlatformCommercialHealthClientOptions,
): Promise<OpenPlatformCommercialHealthClientResult> {
  const tenantsResult = await listOpenPlatformTenants(options);
  if (!tenantsResult.ok) {
    return { ok: false, error: tenantsResult.error };
  }

  const auditEventsResult = await listOpenPlatformAuditEvents(
    { result: 'denied', limit: 100 },
    options,
  );
  if (!auditEventsResult.ok) {
    return { ok: false, error: auditEventsResult.error };
  }

  return {
    ok: true,
    health: buildPlatformCommercialHealthViewModel({
      tenants: tenantsResult.records,
      auditEvents: auditEventsResult.records,
      now: options?.now,
    }),
  };
}
