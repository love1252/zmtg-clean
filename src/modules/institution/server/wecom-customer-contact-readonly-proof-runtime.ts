import type {
  WeComCustomerContactReadonlyProofClient,
  WeComCustomerContactReadonlyProofConfig,
  WeComCustomerContactReadonlyProofDiagnostic,
} from '@/modules/institution/domain/wecom-customer-contact-readonly-proof';

const allowedEnvKeys = {
  corpId: 'ZMTG_WECOM_CORP_ID',
  customerContactSecret: 'ZMTG_WECOM_CUSTOMER_CONTACT_SECRET',
  testEmployeeUserId: 'ZMTG_WECOM_CUSTOMER_CONTACT_TEST_EMPLOYEE_USER_ID',
  capabilityEnabled: 'ZMTG_WECOM_CUSTOMER_CONTACT_CAPABILITY_ENABLED',
  permissionConfirmed: 'ZMTG_WECOM_CUSTOMER_CONTACT_PERMISSION_CONFIRMED',
  credentialPlaceholderReady: 'ZMTG_WECOM_CUSTOMER_CONTACT_SECRET_PLACEHOLDER_READY',
  singleEmployeeSelected: 'ZMTG_WECOM_CUSTOMER_CONTACT_SINGLE_EMPLOYEE_SELECTED',
  networkEnabled: 'ZMTG_WECOM_REAL_NETWORK_ENABLED',
  customerReadEnabled: 'ZMTG_WECOM_CUSTOMER_CONTACT_READ_ENABLED',
  realSendEnabled: 'ZMTG_WECOM_REAL_SEND_ENABLED',
} as const;

const weComRequestTimeoutMs = 10_000;
const weComResponseMaxBytes = 1_000_000;

const authErrorCodes = new Set([40001, 40013, 40014, 42001]);
const permissionErrorCodes = new Set([48002, 60011, 60020]);

function readOptionalEnv(env: NodeJS.ProcessEnv, key: keyof typeof allowedEnvKeys) {
  const value = env[allowedEnvKeys[key]]?.trim();
  return value ? value : null;
}

function readBooleanEnv(env: NodeJS.ProcessEnv, key: keyof typeof allowedEnvKeys) {
  return env[allowedEnvKeys[key]] === 'true';
}

export function readWeComCustomerContactReadonlyProofConfig(
  env: NodeJS.ProcessEnv = process.env,
): WeComCustomerContactReadonlyProofConfig {
  return {
    corpId: readOptionalEnv(env, 'corpId'),
    customerContactSecret: readOptionalEnv(env, 'customerContactSecret'),
    testEmployeeUserId: readOptionalEnv(env, 'testEmployeeUserId'),
    capabilityEnabled: readBooleanEnv(env, 'capabilityEnabled'),
    permissionConfirmed: readBooleanEnv(env, 'permissionConfirmed'),
    credentialPlaceholderReady: readBooleanEnv(env, 'credentialPlaceholderReady'),
    singleEmployeeSelected: readBooleanEnv(env, 'singleEmployeeSelected'),
    networkEnabled: readBooleanEnv(env, 'networkEnabled'),
    customerReadEnabled: readBooleanEnv(env, 'customerReadEnabled'),
    realSendEnabled: readBooleanEnv(env, 'realSendEnabled'),
  };
}

function diagnostic(
  stage: WeComCustomerContactReadonlyProofDiagnostic['stage'],
  errcode: number,
) {
  return { stage, wecomErrcode: errcode } satisfies WeComCustomerContactReadonlyProofDiagnostic;
}

type ParsedPayloadOutcome =
  | { ok: true; value: Record<string, unknown> }
  | {
      ok: false;
      reason: 'auth_failed' | 'permission_failed' | 'network_error' | 'failed';
      diagnostic?: WeComCustomerContactReadonlyProofDiagnostic;
    };

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>) {
  try {
    await reader.cancel();
  } catch {
    // The response remains a low-sensitive failure even if stream cancellation fails.
  }
}

function responseFailure(
  stage: WeComCustomerContactReadonlyProofDiagnostic['stage'],
  errcode: number,
): ParsedPayloadOutcome {
  if (authErrorCodes.has(errcode)) {
    return { ok: false, reason: 'auth_failed', diagnostic: diagnostic(stage, errcode) };
  }
  if (permissionErrorCodes.has(errcode)) {
    return { ok: false, reason: 'permission_failed', diagnostic: diagnostic(stage, errcode) };
  }
  return { ok: false, reason: 'failed', diagnostic: diagnostic(stage, errcode) };
}

function parseSuccessfulPayload(
  payload: unknown,
  stage: WeComCustomerContactReadonlyProofDiagnostic['stage'],
): ParsedPayloadOutcome {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { ok: false, reason: 'failed' };
  }

  const value = payload as Record<string, unknown>;
  if (value.errcode === 0) return { ok: true, value };
  if (typeof value.errcode === 'number') return responseFailure(stage, value.errcode);
  return { ok: false, reason: 'failed' };
}

function addedAtFromDetail(
  payload: Record<string, unknown>,
  externalUserId: string,
  testEmployeeUserId: string,
): { valid: true; addedAt: string | null } | { valid: false } {
  const externalContact = payload.external_contact;
  if (
    typeof externalContact !== 'object' ||
    externalContact === null ||
    Array.isArray(externalContact) ||
    (externalContact as { external_userid?: unknown }).external_userid !== externalUserId
  ) {
    return { valid: false };
  }

  if (!Array.isArray(payload.follow_user)) return { valid: false };

  const relation = payload.follow_user.find((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    return (value as { userid?: unknown }).userid === testEmployeeUserId;
  });
  if (typeof relation !== 'object' || relation === null || Array.isArray(relation)) {
    return { valid: false };
  }

  const createTime = (relation as { createtime?: unknown }).createtime;
  if (typeof createTime !== 'number' || !Number.isSafeInteger(createTime) || createTime < 0) {
    return { valid: true, addedAt: null };
  }

  const timestamp = createTime * 1000;
  const date = new Date(timestamp);
  return {
    valid: true,
    addedAt: Number.isNaN(date.getTime()) ? null : date.toISOString(),
  };
}

async function readJsonResponse(
  response: Response,
): Promise<{ ok: true; payload: unknown } | { ok: false }> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > weComResponseMaxBytes) {
    await response.body?.cancel();
    return { ok: false };
  }
  if (!response.body) return { ok: false };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = '';

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;

      byteLength += chunk.value.byteLength;
      if (byteLength > weComResponseMaxBytes) {
        await cancelReader(reader);
        return { ok: false };
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, payload: JSON.parse(text) };
  } catch {
    await cancelReader(reader);
    return { ok: false };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore release failures and keep the response low-sensitive.
    }
  }
}

async function fetchJson(
  fetcher: typeof fetch,
  url: URL,
): Promise<{ ok: true; payload: unknown } | { ok: false }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), weComRequestTimeoutMs);

  try {
    const response = await fetcher(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      return { ok: false };
    }

    return await readJsonResponse(response);
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

export function createWeComCustomerContactReadonlyProofClient(
  fetcher: typeof fetch = fetch,
): WeComCustomerContactReadonlyProofClient {
  return {
    async readSingleExternalContactOnce(input) {
      const tokenUrl = new URL('https://qyapi.weixin.qq.com/cgi-bin/gettoken');
      tokenUrl.searchParams.set('corpid', input.corpId);
      tokenUrl.searchParams.set('corpsecret', input.customerContactSecret);

      const tokenResponse = await fetchJson(fetcher, tokenUrl);
      if (!tokenResponse.ok) return { ok: false, reason: 'network_error' };

      const tokenPayload = parseSuccessfulPayload(tokenResponse.payload, 'gettoken');
      if (!tokenPayload.ok) return tokenPayload;

      const accessToken = tokenPayload.value.access_token;
      if (typeof accessToken !== 'string' || !accessToken.trim()) {
        return { ok: false, reason: 'failed' };
      }

      const listUrl = new URL('https://qyapi.weixin.qq.com/cgi-bin/externalcontact/list');
      listUrl.searchParams.set('access_token', accessToken);
      listUrl.searchParams.set('userid', input.testEmployeeUserId);

      const listResponse = await fetchJson(fetcher, listUrl);
      if (!listResponse.ok) return { ok: false, reason: 'network_error' };

      const listPayload = parseSuccessfulPayload(listResponse.payload, 'externalcontact_list');
      if (!listPayload.ok) return listPayload;

      const externalUserIds = listPayload.value.external_userid;
      if (!Array.isArray(externalUserIds)) return { ok: false, reason: 'failed' };
      if (externalUserIds.length === 0) {
        return { ok: false, reason: 'no_external_contact' };
      }
      if (externalUserIds.length !== 1) {
        return { ok: false, reason: 'external_contact_scope_not_single' };
      }

      const externalUserId = externalUserIds[0];
      if (typeof externalUserId !== 'string' || !externalUserId.trim()) {
        return { ok: false, reason: 'failed' };
      }

      const detailUrl = new URL('https://qyapi.weixin.qq.com/cgi-bin/externalcontact/get');
      detailUrl.searchParams.set('access_token', accessToken);
      detailUrl.searchParams.set('external_userid', externalUserId);

      const detailResponse = await fetchJson(fetcher, detailUrl);
      if (!detailResponse.ok) return { ok: false, reason: 'network_error' };

      const detailPayload = parseSuccessfulPayload(
        detailResponse.payload,
        'externalcontact_get',
      );
      if (!detailPayload.ok) return detailPayload;

      const detail = addedAtFromDetail(
        detailPayload.value,
        externalUserId,
        input.testEmployeeUserId,
      );
      if (!detail.valid) return { ok: false, reason: 'failed' };

      return {
        ok: true,
        addedAt: detail.addedAt,
      };
    },
  };
}
