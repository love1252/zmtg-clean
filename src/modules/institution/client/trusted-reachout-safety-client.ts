import {
  weComReachOutConsentActions,
  weComReachOutConsentConfirmations,
  weComReachOutConsentSourceTypes,
  weComReachOutConsentStatuses,
  type WeComReachOutConsentAction,
  type WeComReachOutConsentSourceType,
  type WeComReachOutConsentStatus,
} from '@/modules/institution/domain/trusted-reachout-safety';

export type TrustedReachOutSafety = {
  consent: {
    status: WeComReachOutConsentStatus;
    sourceType: WeComReachOutConsentSourceType | null;
    recordedAt: string | null;
  };
  frequency: {
    windowStartedAt: string | null;
    windowEndsAt: string | null;
    preparedCount: number;
    completedCount: number;
    maxPreparedCount: 1;
    maxCompletedCount: 1;
    nextAllowedAt: string | null;
  };
};

export type TrustedReachOutSafetyReadResponse = {
  safety: TrustedReachOutSafety;
  canWrite: boolean;
  channelType: 'wechat_work';
};

type ClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { status: number; code: string | null; message: string } };
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

async function readJson(response: Response) {
  try { return await response.json() as unknown; } catch { return null; }
}

function parseNullableDate(value: unknown) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : value === null ? null : undefined;
}

function parseSafety(payload: unknown): TrustedReachOutSafetyReadResponse | null {
  if (!isRecord(payload) || !isRecord(payload.safety) || !isRecord(payload.safety.consent) || !isRecord(payload.safety.frequency)) return null;
  const consent = payload.safety.consent;
  const frequency = payload.safety.frequency;
  const sourceType = consent.sourceType === null || weComReachOutConsentSourceTypes.includes(consent.sourceType as WeComReachOutConsentSourceType)
    ? consent.sourceType as WeComReachOutConsentSourceType | null
    : undefined;
  const recordedAt = parseNullableDate(consent.recordedAt);
  const windowStartedAt = parseNullableDate(frequency.windowStartedAt);
  const windowEndsAt = parseNullableDate(frequency.windowEndsAt);
  const nextAllowedAt = parseNullableDate(frequency.nextAllowedAt);
  if (
    !weComReachOutConsentStatuses.includes(consent.status as WeComReachOutConsentStatus) ||
    sourceType === undefined || recordedAt === undefined || windowStartedAt === undefined ||
    windowEndsAt === undefined || nextAllowedAt === undefined ||
    !Number.isInteger(frequency.preparedCount) || !Number.isInteger(frequency.completedCount) ||
    frequency.maxPreparedCount !== 1 || frequency.maxCompletedCount !== 1 ||
    typeof payload.canWrite !== 'boolean' || payload.channelType !== 'wechat_work'
  ) return null;
  return {
    safety: {
      consent: { status: consent.status as WeComReachOutConsentStatus, sourceType, recordedAt },
      frequency: {
        windowStartedAt, windowEndsAt,
        preparedCount: frequency.preparedCount as number,
        completedCount: frequency.completedCount as number,
        maxPreparedCount: 1, maxCompletedCount: 1, nextAllowedAt,
      },
    },
    canWrite: payload.canWrite,
    channelType: 'wechat_work',
  };
}

function error(status: number, payload: unknown) {
  return {
    status,
    code: isRecord(payload) && typeof payload.code === 'string' ? payload.code : null,
    message: isRecord(payload) && typeof payload.error === 'string' ? payload.error : '请求失败',
  };
}

export async function getTrustedReachOutSafety(customerId: string, fetcher: Fetcher = fetch): Promise<ClientResult<TrustedReachOutSafetyReadResponse>> {
  try {
    const response = await fetcher(`/api/institution/customers/${encodeURIComponent(customerId)}/wecom-reachout-safety`, { method: 'GET', cache: 'no-store' });
    const payload = await readJson(response);
    if (!response.ok) return { ok: false, error: error(response.status, payload) };
    const data = parseSafety(payload);
    return data ? { ok: true, data } : { ok: false, error: { status: response.status, code: null, message: '响应格式不正确' } };
  } catch {
    return { ok: false, error: { status: 0, code: null, message: '请求失败' } };
  }
}

export async function updateTrustedReachOutConsent(input: {
  customerId: string;
  action: WeComReachOutConsentAction;
  sourceType: WeComReachOutConsentSourceType;
}, fetcher: Fetcher = fetch): Promise<ClientResult<TrustedReachOutSafety['consent']>> {
  if (!weComReachOutConsentActions.includes(input.action)) {
    return { ok: false, error: { status: 0, code: null, message: '请求格式不正确' } };
  }
  try {
    const response = await fetcher(`/api/institution/customers/${encodeURIComponent(input.customerId)}/wecom-reachout-safety`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: input.action,
        sourceType: input.sourceType,
        confirmation: weComReachOutConsentConfirmations[input.action],
      }),
    });
    const payload = await readJson(response);
    if (!response.ok) return { ok: false, error: error(response.status, payload) };
    if (!isRecord(payload) || !isRecord(payload.consent)) return { ok: false, error: { status: response.status, code: null, message: '响应格式不正确' } };
    const parsed = parseSafety({
      safety: {
        consent: payload.consent,
        frequency: { windowStartedAt: null, windowEndsAt: null, preparedCount: 0, completedCount: 0, maxPreparedCount: 1, maxCompletedCount: 1, nextAllowedAt: null },
      },
      canWrite: true,
      channelType: 'wechat_work',
    });
    return parsed ? { ok: true, data: parsed.safety.consent } : { ok: false, error: { status: response.status, code: null, message: '响应格式不正确' } };
  } catch {
    return { ok: false, error: { status: 0, code: null, message: '请求失败' } };
  }
}
