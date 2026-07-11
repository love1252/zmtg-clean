import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getTrustedReachOutSafety,
  updateTrustedReachOutConsent,
} from '@/modules/institution/client/trusted-reachout-safety-client';

const safety = {
  consent: { status: 'consented', sourceType: 'customer_explicit_written', recordedAt: '2026-07-11T00:00:00.000Z' },
  frequency: {
    windowStartedAt: '2026-07-11T00:00:00.000Z', windowEndsAt: '2026-07-12T00:00:00.000Z',
    preparedCount: 1, completedCount: 0, maxPreparedCount: 1, maxCompletedCount: 1,
    nextAllowedAt: '2026-07-12T00:00:00.000Z',
  },
};

afterEach(() => vi.restoreAllMocks());

describe('可信触达安全 client', () => {
  it('GET 只保留许可和频控白名单字段', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      safety,
      canWrite: true,
      channelType: 'wechat_work',
      secret: 'should-drop',
      corpId: 'should-drop',
      UserID: 'should-drop',
      rawPayload: { token: 'should-drop' },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const result = await getTrustedReachOutSafety('customer-1', fetcher);
    expect(result).toEqual({ ok: true, data: { safety, canWrite: true, channelType: 'wechat_work' } });
    expect(JSON.stringify(result)).not.toMatch(/secret|token|corpId|UserID|rawPayload/i);
  });

  it('POST 仅发送动作、来源和精确 confirmation', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      outcome: 'updated', consent: safety.consent,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await updateTrustedReachOutConsent({
      customerId: 'customer-1', action: 'record_opt_out', sourceType: 'customer_opt_out_request',
    }, fetcher);
    const [, init] = fetcher.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      action: 'record_opt_out',
      sourceType: 'customer_opt_out_request',
      confirmation: '我确认客户已明确要求停止企业微信联系',
    });
    expect(init.body).not.toMatch(/status|evidenceRef|tenantId|institutionId|count|allow/i);
  });
});
