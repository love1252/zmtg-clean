import { describe, expect, it } from 'vitest';

import { validateSameOriginMutationRequest } from '@/modules/security/server/mutation-request-security';

const requestFor = (
  url = 'https://institution.example.test:8443/api/mutation',
  headers: HeadersInit = { origin: 'https://institution.example.test:8443' },
  body?: BodyInit,
) => new Request(url, {
  method: 'POST',
  headers,
  ...(body === undefined ? {} : { body }),
});

const csrfFailure = { ok: false, reasonCode: 'csrf_validation_failed' } as const;

describe('mutation request same-origin security', () => {
  it('同 scheme、hostname、port 的精确 Origin 通过', () => {
    expect(validateSameOriginMutationRequest(requestFor())).toEqual({ ok: true });
  });

  it.each([
    ['不同 scheme', 'http://institution.example.test:8443'],
    ['不同 hostname', 'https://other.example.test:8443'],
    ['不同 port', 'https://institution.example.test:9443'],
  ])('%s 固定拒绝', (_label, origin) => {
    expect(validateSameOriginMutationRequest(requestFor(undefined, { origin }))).toEqual(csrfFailure);
  });

  it.each([
    ['缺失 Origin', {}],
    ['Origin=null', { origin: 'null' }],
    ['Origin 为空', { origin: '' }],
    ['malformed Origin', { origin: 'not a url' }],
    ['逗号拼接 Origin', { origin: 'https://institution.example.test:8443, https://evil.test' }],
    ['Origin 带 path', { origin: 'https://institution.example.test:8443/path' }],
    ['Origin 带 query', { origin: 'https://institution.example.test:8443?tenant=other' }],
    ['Origin 带 hash', { origin: 'https://institution.example.test:8443#fragment' }],
    ['Origin 带 credentials', { origin: 'https://user:pass@institution.example.test:8443' }],
    ['Origin 使用非 HTTP 协议', { origin: 'ftp://institution.example.test:8443' }],
  ] as const)('%s 固定拒绝', (_label, headers) => {
    expect(validateSameOriginMutationRequest(requestFor(undefined, headers))).toEqual(csrfFailure);
  });

  it('Sec-Fetch-Site=same-origin 通过', () => {
    expect(validateSameOriginMutationRequest(requestFor(undefined, {
      origin: 'https://institution.example.test:8443',
      'sec-fetch-site': 'same-origin',
    }))).toEqual({ ok: true });
  });

  it.each(['same-site', 'cross-site', 'none', 'unknown', 'same-origin, cross-site'])('Sec-Fetch-Site=%s 固定拒绝', (site) => {
    expect(validateSameOriginMutationRequest(requestFor(undefined, {
      origin: 'https://institution.example.test:8443',
      'sec-fetch-site': site,
    }))).toEqual(csrfFailure);
  });

  it('缺失 Sec-Fetch-Site 时由 Origin 精确匹配通过', () => {
    expect(validateSameOriginMutationRequest(requestFor())).toEqual({ ok: true });
  });

  it('不信任 Host 与 X-Forwarded-*，不能用转发头绕过 URL origin', () => {
    expect(validateSameOriginMutationRequest(requestFor(
      'https://internal.example.test/api/mutation',
      {
        origin: 'https://public.example.test',
        host: 'public.example.test',
        'x-forwarded-host': 'public.example.test',
        'x-forwarded-proto': 'https',
      },
    ))).toEqual(csrfFailure);
  });

  it('失败结果不回显恶意 Origin', () => {
    const maliciousOrigin = 'https://user:secret@evil.example.test/path?token=raw#fragment';
    const result = validateSameOriginMutationRequest(requestFor(undefined, { origin: maliciousOrigin }));
    expect(result).toEqual(csrfFailure);
    expect(JSON.stringify(result)).not.toContain(maliciousOrigin);
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('helper 不读取或修改请求 body', async () => {
    const request = requestFor(
      undefined,
      { origin: 'https://institution.example.test:8443' },
      JSON.stringify({ action: 'mapping_review' }),
    );
    expect(request.bodyUsed).toBe(false);
    expect(validateSameOriginMutationRequest(request)).toEqual({ ok: true });
    expect(request.bodyUsed).toBe(false);
    expect(await request.text()).toBe(JSON.stringify({ action: 'mapping_review' }));
  });
});
