import { describe, expect, it, vi } from 'vitest';
import {
  getWeComCustomerMapping,
  updateWeComCustomerMapping,
} from '@/modules/institution/client/wecom-customer-mapping-client';

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const mapping = {
  proofContactId: 'live-contact-proof-01',
  proofEmployeeId: 'live-employee-proof-01',
  sourceMode: 'real_readonly_proof',
  status: 'confirmed',
  customerId: 'customer-a',
};

const candidate = {
  customerId: 'customer-a',
  displayName: '低敏客户 A',
  maskedPhone: '138****0000',
  maskedMedicalRecordNo: 'MR-***-01',
  lifecycle: 'consulting',
  priority: 'high',
};

describe('WeComCustomerMappingClient', () => {
  it('GET 只保留正式低敏响应字段', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      response({
        mapping,
        candidates: [{ ...candidate, external_userid: 'forbidden-external-id' }],
        currentCustomer: { ...candidate, rawResponse: 'forbidden-response' },
        canWrite: true,
        access_token: 'forbidden-token',
      }),
    );

    const result = await getWeComCustomerMapping({ fetcher });

    expect(result).toEqual({
      ok: true,
      data: {
        mapping,
        candidates: [candidate],
        currentCustomer: candidate,
        canWrite: true,
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /external_userid|rawResponse|access_token|forbidden-/i,
    );
    expect(fetcher).toHaveBeenCalledWith('/api/institution/wecom-customer-mapping', {
      method: 'GET',
      cache: 'no-store',
    });
  });

  it('POST 只提交 action、固定 proofContactId 和 customerId', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      response({ outcome: 'updated', mapping }),
    );

    const result = await updateWeComCustomerMapping(
      { action: 'confirm', customerId: 'customer-a' },
      { fetcher },
    );

    expect(result).toEqual({ ok: true, data: { outcome: 'updated', mapping } });
    expect(fetcher).toHaveBeenCalledWith('/api/institution/wecom-customer-mapping', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'confirm',
        proofContactId: 'live-contact-proof-01',
        customerId: 'customer-a',
      }),
    });
    expect(fetcher.mock.calls[0]?.[1]?.body).not.toMatch(
      /tenantId|institutionId|proofEmployeeId|sourceMode|external_userid/i,
    );
  });
});
