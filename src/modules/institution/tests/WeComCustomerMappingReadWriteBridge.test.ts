import { describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/institution/wecom/customer-mapping-candidates/route';
import { POST } from '@/app/api/institution/wecom/customer-mapping-reviews/[mappingId]/actions/route';

vi.mock('@/app/api/institution/_shared/institution-route-guard', () => ({
  withInstitutionSectionRouteGuardV1: ({
    handler,
  }: {
    handler: (...args: unknown[]) => Response | Promise<Response>;
  }) => handler,
}));
import { DEMO_SESSION_COOKIE, encodeDemoSession } from '@/modules/auth/server/demo-session';

const origin = 'http://localhost';
const capabilityDisabledPayload = Object.freeze({ code: 'capability_disabled' });

const getForbiddenFields = [
  'mappingId',
  'mappingVersion',
  'mappingReviewStatus',
  'mappingStatus',
  'manualReviewStatus',
  'mockDemo',
  'candidates',
] as const;

const postForbiddenFields = [
  ...getForbiddenFields,
  'sourceKind',
  'dataMode',
  'candidateReference',
  'authorizationStatus',
  'providerStatus',
  'confidenceLevel',
  'conflictSummary',
  'nextStatus',
  'previousStatus',
  'nextVersion',
  'previousVersion',
  'idempotentReplay',
  'idempotencyKey',
  'auditSummary',
  'acceptedMutationCount',
  'replayCount',
  'autoMergePerformed',
  'realCustomerRelationshipWritten',
  'persistenceMode',
] as const;

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

async function expectCapabilityDisabled(
  response: Response,
  forbiddenFields: readonly string[],
) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');

  const body = await response.json() as Record<string, unknown>;
  expect(body).toEqual(capabilityDisabledPayload);
  for (const field of forbiddenFields) {
    expect(body).not.toHaveProperty(field);
  }

  return body;
}

describe('企业微信客户映射默认 GET／POST Route 能力关闭一致性', () => {
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
    '%s 的默认 GET／POST Route 均保持能力关闭，不建立 read/write bridge',
    async (tenantId, institutionId, mappingId, idempotencyKey) => {
      const request = getRequest(tenantId, institutionId);
      const initial = await expectCapabilityDisabled(
        await GET(request),
        getForbiddenFields,
      );

      const mutationRequest = new Request(
        `${origin}/api/institution/wecom/customer-mapping-reviews/${mappingId}/actions`,
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
            expectedVersion: 0,
            idempotencyKey,
            reasonCode: 'manual_evidence_confirmed',
          }),
        },
      );
      const mutation = await POST(mutationRequest.clone(), {
        params: Promise.resolve({ mappingId }),
      });
      const mutationBody = await expectCapabilityDisabled(
        mutation,
        postForbiddenFields,
      );

      const replay = await POST(mutationRequest.clone(), {
        params: Promise.resolve({ mappingId }),
      });
      const replayBody = await expectCapabilityDisabled(
        replay,
        postForbiddenFields,
      );
      expect(replayBody).toEqual(mutationBody);

      const next = await expectCapabilityDisabled(
        await GET(getRequest(tenantId, institutionId)),
        getForbiddenFields,
      );
      expect(next).toEqual(initial);
    },
  );
});
