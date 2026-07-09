import {
  weComOfficialInternalTestMessageContent,
  type WeComOfficialInternalMessageProofClient,
  type WeComOfficialInternalMessageProofConfig,
  type WeComOfficialInternalMessageProofDiagnostic,
  type WeComOfficialInternalMessageProofSendOutcome,
} from '@/modules/institution/domain/wecom-official-internal-message-proof';

const allowedEnvKeys = {
  corpId: 'ZMTG_WECOM_CORP_ID',
  agentId: 'ZMTG_WECOM_AGENT_ID',
  agentSecret: 'ZMTG_WECOM_AGENT_SECRET',
  internalTestUserId: 'ZMTG_WECOM_INTERNAL_TEST_USER_ID',
  networkEnabled: 'ZMTG_WECOM_REAL_NETWORK_ENABLED',
  realSendEnabled: 'ZMTG_WECOM_REAL_SEND_ENABLED',
} as const;

function readOptionalEnv(env: NodeJS.ProcessEnv, key: keyof typeof allowedEnvKeys) {
  const value = env[allowedEnvKeys[key]]?.trim();
  return value ? value : null;
}

export function readWeComOfficialInternalMessageProofConfig(
  env: NodeJS.ProcessEnv = process.env,
): WeComOfficialInternalMessageProofConfig {
  return {
    corpId: readOptionalEnv(env, 'corpId'),
    agentId: readOptionalEnv(env, 'agentId'),
    agentSecret: readOptionalEnv(env, 'agentSecret'),
    internalTestUserId: readOptionalEnv(env, 'internalTestUserId'),
    networkEnabled: env.ZMTG_WECOM_REAL_NETWORK_ENABLED === 'true',
    realSendEnabled: env.ZMTG_WECOM_REAL_SEND_ENABLED === 'true',
  };
}

function diagnostic(stage: WeComOfficialInternalMessageProofDiagnostic['stage'], errcode: number) {
  return { stage, wecomErrcode: errcode } satisfies WeComOfficialInternalMessageProofDiagnostic;
}

function lowSensitiveTokenOutcomeFromResponse(payload: unknown):
  | { ok: true; accessToken: string }
  | { ok: false; reason: 'auth_failed' | 'network_error'; diagnostic?: WeComOfficialInternalMessageProofDiagnostic } {
  if (typeof payload !== 'object' || payload === null) return { ok: false, reason: 'network_error' };

  const errcode = (payload as { errcode?: unknown }).errcode;
  const accessToken = (payload as { access_token?: unknown }).access_token;

  if (errcode === 0 && typeof accessToken === 'string' && accessToken.trim()) {
    return { ok: true, accessToken };
  }

  if (typeof errcode !== 'number') return { ok: false, reason: 'network_error' };

  if (errcode === 40001 || errcode === 40013 || errcode === 48002 || errcode === 60020) {
    return { ok: false, reason: 'auth_failed', diagnostic: diagnostic('gettoken', errcode) };
  }

  return { ok: false, reason: 'network_error', diagnostic: diagnostic('gettoken', errcode) };
}

function lowSensitiveSendOutcomeFromResponse(payload: unknown): WeComOfficialInternalMessageProofSendOutcome {
  if (typeof payload !== 'object' || payload === null) return { ok: false, reason: 'send_failed' };

  const errcode = (payload as { errcode?: unknown }).errcode;
  if (errcode === 0) return { ok: true };
  if (typeof errcode !== 'number') return { ok: false, reason: 'send_failed' };
  if (errcode === 40001 || errcode === 40013 || errcode === 48002 || errcode === 60020) {
    return { ok: false, reason: 'auth_failed', diagnostic: diagnostic('message_send', errcode) };
  }

  return { ok: false, reason: 'send_failed', diagnostic: diagnostic('message_send', errcode) };
}

export function createWeComOfficialInternalMessageProofClient(
  fetcher: typeof fetch = fetch,
): WeComOfficialInternalMessageProofClient {
  return {
    async sendInternalTestMessage(input) {
      try {
        const tokenUrl = new URL('https://qyapi.weixin.qq.com/cgi-bin/gettoken');
        tokenUrl.searchParams.set('corpid', input.corpId);
        tokenUrl.searchParams.set('corpsecret', input.agentSecret);

        const tokenResponse = await fetcher(tokenUrl, { method: 'GET', cache: 'no-store' });
        if (!tokenResponse.ok) return { ok: false, reason: 'network_error' };

        const tokenOutcome = lowSensitiveTokenOutcomeFromResponse(await tokenResponse.json());
        if (!tokenOutcome.ok) {
          return {
            ok: false,
            reason: tokenOutcome.reason,
            ...(tokenOutcome.diagnostic ? { diagnostic: tokenOutcome.diagnostic } : {}),
          };
        }

        const sendUrl = new URL('https://qyapi.weixin.qq.com/cgi-bin/message/send');
        sendUrl.searchParams.set('access_token', tokenOutcome.accessToken);

        const sendResponse = await fetcher(sendUrl, {
          method: 'POST',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            touser: input.internalTestUserId,
            msgtype: 'text',
            agentid: Number(input.agentId),
            text: { content: weComOfficialInternalTestMessageContent },
            safe: 0,
            enable_id_trans: 0,
            enable_duplicate_check: 0,
          }),
        });
        if (!sendResponse.ok) return { ok: false, reason: 'network_error' };

        return lowSensitiveSendOutcomeFromResponse(await sendResponse.json());
      } catch {
        return { ok: false, reason: 'network_error' };
      }
    },
  };
}
