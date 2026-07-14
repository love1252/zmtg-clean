import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/institution/wecom/customer-mapping-candidates/route';
import { POST } from '@/app/api/institution/wecom/customer-mapping-reviews/[mappingId]/actions/route';
import { DEMO_SESSION_COOKIE, encodeDemoSession } from '@/modules/auth/server/demo-session';

const origin = 'http://localhost';

function getRequest(tenantId: string, institutionId: string) {
  return new Request(`${origin}/api/institution/wecom/customer-mapping-candidates`, {
    headers: {
      cookie: `${DEMO_SESSION_COOKIE}=${encodeDemoSession({
        user: {
          id: 'bridge-admin',
          username: 'bridge-admin',
          name: '机构管理员',
          role: 'tenant_admin',
          tenantId,
          institutionId,
        },
        expiresAt: Date.now() + 60_000,
        source: 'demo_session',
      })}`,
    },
  });
}

describe('WeCom customer mapping default read/write runtime bridge', () => {
  it.each([
    [
      'trial-tenant-yunlan',
      'trial-inst-yunlan',
      'mock-wecom-mapping-yunlan-001',
      'default-bridge-yunlan-01',
    ],
    [
      'trial-tenant-baiyue',
      'trial-inst-baiyue',
      'mock-wecom-mapping-baiyue-001',
      'default-bridge-baiyue-01',
    ],
    [
      'starter-tenant-xinghe',
      'starter-inst-xinghe',
      'mock-wecom-mapping-xinghe-001',
      'default-bridge-xinghe-01',
    ],
    [
      'starter-tenant-yubai',
      'starter-inst-yubai',
      'mock-wecom-mapping-yubai-001',
      'default-bridge-yubai-001',
    ],
    [
      'growth-tenant-chengxing',
      'growth-inst-chengxing',
      'mock-wecom-mapping-pending-001',
      'default-bridge-chengxing-1',
    ],
    [
      'growth-tenant-qingmang',
      'growth-inst-qingmang',
      'mock-wecom-mapping-qingmang-001',
      'default-bridge-qingmang-01',
    ],
  ] as const)(
    '%s 的默认 GET tuple 可直接提交到默认 POST，随后 GET 返回唯一一次 version 增长',
    async (tenantId, institutionId, mappingId, idempotencyKey) => {
      const request = getRequest(tenantId, institutionId);
      const initial = await (await GET(request)).json();
      expect(initial).toMatchObject({
        mappingId,
        mappingVersion: 0,
        mappingReviewStatus: 'pending_review',
        mappingStatus: 'manual_review_required',
        manualReviewStatus: 'required',
      });

      const mutationRequest = new Request(
        `${origin}/api/institution/wecom/customer-mapping-reviews/${initial.mappingId}/actions`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin,
            'sec-fetch-site': 'same-origin',
            cookie: request.headers.get('cookie')!,
          },
          body: JSON.stringify({
            action: 'approve_candidate',
            expectedVersion: initial.mappingVersion,
            idempotencyKey,
            reasonCode: 'manual_evidence_confirmed',
          }),
        },
      );
      const mutation = await POST(mutationRequest.clone(), {
        params: Promise.resolve({ mappingId: initial.mappingId }),
      });
      expect(mutation.status).toBe(200);
      expect(await mutation.json()).toMatchObject({
        nextStatus: 'approved_pending_link',
        nextVersion: initial.mappingVersion + 1,
        idempotentReplay: false,
      });

      const replay = await POST(mutationRequest.clone(), {
        params: Promise.resolve({ mappingId: initial.mappingId }),
      });
      expect(replay.status).toBe(200);
      expect(await replay.json()).toMatchObject({
        nextStatus: 'approved_pending_link',
        nextVersion: initial.mappingVersion + 1,
        idempotentReplay: true,
      });

      const next = await (await GET(getRequest(tenantId, institutionId))).json();
      expect(next).toMatchObject({
        mappingId: initial.mappingId,
        mappingVersion: initial.mappingVersion + 1,
        mappingReviewStatus: 'approved_pending_link',
        mappingStatus: 'manual_review_required',
        manualReviewStatus: 'required',
      });
    },
  );
});
