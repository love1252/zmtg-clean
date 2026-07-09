import type {
  WeComOfficialSecretPrecheckConfig,
  WeComOfficialTokenPreflightClient,
  WeComOfficialTokenPreflightOutcome,
} from '@/modules/institution/domain/wecom-official-secret-precheck';

const allowedEnvKeys = {
  corpId: 'ZMTG_WECOM_CORP_ID',
  agentId: 'ZMTG_WECOM_AGENT_ID',
  agentSecret: 'ZMTG_WECOM_AGENT_SECRET',
  networkEnabled: 'ZMTG_WECOM_REAL_NETWORK_ENABLED',
  realSendEnabled: 'ZMTG_WECOM_REAL_SEND_ENABLED',
} as const;

function readOptionalEnv(env: NodeJS.ProcessEnv, key: keyof typeof allowedEnvKeys) {
  const value = env[allowedEnvKeys[key]]?.trim();
  return value ? value : null;
}

export function readWeComOfficialSecretPrecheckConfig(
  env: NodeJS.ProcessEnv = process.env,
): WeComOfficialSecretPrecheckConfig {
  return {
    corpId: readOptionalEnv(env, 'corpId'),
    agentId: readOptionalEnv(env, 'agentId'),
    agentSecret: readOptionalEnv(env, 'agentSecret'),
    networkEnabled: env.ZMTG_WECOM_REAL_NETWORK_ENABLED === 'true',
    realSendEnabled: env.ZMTG_WECOM_REAL_SEND_ENABLED === 'true',
  };
}

function lowSensitiveOutcomeFromResponse(payload: unknown): WeComOfficialTokenPreflightOutcome {
  if (typeof payload !== 'object' || payload === null) return { ok: false, reason: 'failed' };

  const errcode = (payload as { errcode?: unknown }).errcode;
  if (errcode === 0) return { ok: true };
  if (errcode === 40001 || errcode === 40013 || errcode === 48002 || errcode === 60020) {
    return { ok: false, reason: 'auth_failed' };
  }

  return { ok: false, reason: 'failed' };
}

export function createWeComOfficialTokenPreflightClient(
  fetcher: typeof fetch = fetch,
): WeComOfficialTokenPreflightClient {
  return {
    async checkToken(input) {
      try {
        const url = new URL('https://qyapi.weixin.qq.com/cgi-bin/gettoken');
        url.searchParams.set('corpid', input.corpId);
        url.searchParams.set('corpsecret', input.agentSecret);

        const response = await fetcher(url, { method: 'GET', cache: 'no-store' });
        if (!response.ok) return { ok: false, reason: 'network_error' };

        return lowSensitiveOutcomeFromResponse(await response.json());
      } catch {
        return { ok: false, reason: 'network_error' };
      }
    },
  };
}
