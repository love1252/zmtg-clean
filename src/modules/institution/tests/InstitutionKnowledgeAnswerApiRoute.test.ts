import { describe, expect, it } from 'vitest';

import * as answerRoute from '@/app/api/institution/knowledge-management/answer/route';

const expectedPayload = {
  status: 'capability_disabled',
  code: 'knowledge_capability_disabled',
  answer: '机构知识库问答暂未启用。仅供内部运营参考，需人工确认',
  sources: [],
};

async function expectCapabilityDisabled(request?: Request) {
  const response = await answerRoute.POST(request);

  expect(response.status).toBe(503);
  await expect(response.json()).resolves.toEqual(expectedPayload);
}

function requestWithThrowingAccessors() {
  let headersRead = 0;
  let jsonRead = 0;
  const request = {};
  Object.defineProperties(request, {
    headers: {
      enumerable: true,
      get: () => {
        headersRead += 1;
        throw new Error('headers must not be read');
      },
    },
    json: {
      enumerable: true,
      get: () => {
        jsonRead += 1;
        throw new Error('json must not be read');
      },
    },
  });

  return {
    request: request as Request,
    reads: () => ({ headersRead, jsonRead }),
  };
}

describe('机构端知识库 answer API route', () => {
  it('只导出 POST，不提供 GET handler', () => {
    expect(Object.keys(answerRoute).sort()).toEqual(['POST']);
  });

  it('普通请求固定返回低敏 capability_disabled', async () => {
    await expectCapabilityDisabled(
      new Request('http://localhost/api/institution/knowledge-management/answer', {
        method: 'POST',
        body: JSON.stringify({ question: '术后冷敷注意事项？' }),
      }),
    );
  });

  it('未登录和伪造 scope/header 的请求得到同一固定响应', async () => {
    await expectCapabilityDisabled(
      new Request('http://localhost/api/institution/knowledge-management/answer', {
        method: 'POST',
      }),
    );
    await expectCapabilityDisabled(
      new Request('http://localhost/api/institution/knowledge-management/answer', {
        method: 'POST',
        headers: {
          'x-tenant-id': 'forged-tenant',
          'x-institution-id': 'forged-institution',
          authorization: 'Bearer forged',
        },
      }),
    );
  });

  it('带 provider/model 字段的请求不触发字段解析或不同状态', async () => {
    await expectCapabilityDisabled(
      new Request('http://localhost/api/institution/knowledge-management/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: 'forged-provider',
          model: 'forged-model',
          question: 'ignored',
        }),
      }),
    );
  });

  it('不读取 request.json 或 headers accessor', async () => {
    const poisoned = requestWithThrowingAccessors();

    await expect(expectCapabilityDisabled(poisoned.request)).resolves.toBeUndefined();
    expect(poisoned.reads()).toEqual({ headersRead: 0, jsonRead: 0 });
  });
});
