import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';

import {
  resolveInstitutionGuardRuntimeConfigV1,
  type InstitutionGuardRuntimeConfigInputV1,
} from '@/modules/security/server/institution-guard-runtime-config';

const NOW = new Date('2026-07-22T12:00:00.000Z');
const FORMAL_CURRENT = new Uint8Array(32).fill(0x61);
const FORMAL_OLD = new Uint8Array(32).fill(0x62);
const GUARD_CURRENT = new Uint8Array(32).fill(0x63);
const ENVIRONMENT_KEYS = [
  'ZMTG_FORMAL_SESSION_HMAC_KEY_VERSION',
  'ZMTG_FORMAL_SESSION_HMAC_KEY_BASE64URL',
  'ZMTG_FORMAL_SESSION_HMAC_VERIFY_ONLY_JSON',
  'ZMTG_INSTITUTION_GUARD_HMAC_KEY_VERSION',
  'ZMTG_INSTITUTION_GUARD_HMAC_KEY_BASE64URL',
  'ZMTG_INSTITUTION_GUARD_HMAC_VERIFY_ONLY_JSON',
] as const;

function encoded(value: Uint8Array) {
  return Buffer.from(value).toString('base64url');
}

function environment(overrides: Partial<Record<(typeof ENVIRONMENT_KEYS)[number], string | undefined>> = {}) {
  return {
    ZMTG_FORMAL_SESSION_HMAC_KEY_VERSION: '2',
    ZMTG_FORMAL_SESSION_HMAC_KEY_BASE64URL: encoded(FORMAL_CURRENT),
    ZMTG_FORMAL_SESSION_HMAC_VERIFY_ONLY_JSON: JSON.stringify([
      {
        keyVersion: 1,
        keyMaterialBase64Url: encoded(FORMAL_OLD),
        verifyUntil: '2026-07-22T13:00:00.000Z',
      },
    ]),
    ZMTG_INSTITUTION_GUARD_HMAC_KEY_VERSION: '1',
    ZMTG_INSTITUTION_GUARD_HMAC_KEY_BASE64URL: encoded(GUARD_CURRENT),
    ZMTG_INSTITUTION_GUARD_HMAC_VERIFY_ONLY_JSON: '[]',
    ...overrides,
  };
}

function input(
  overrides: Partial<InstitutionGuardRuntimeConfigInputV1> = {},
): InstitutionGuardRuntimeConfigInputV1 {
  return {
    environment: environment(),
    now: () => new Date(NOW.getTime()),
    ...overrides,
  };
}

function expectUnavailable(value: unknown) {
  expect(value).toEqual({ kind: 'unavailable' });
  expect(JSON.stringify(value)).not.toContain(encoded(FORMAL_CURRENT));
  expect(JSON.stringify(value)).not.toContain(encoded(GUARD_CURRENT));
}

describe('institution guard runtime config', () => {
  it('仅从受控注入环境构造冻结的两套 key ring', () => {
    const result = resolveInstitutionGuardRuntimeConfigV1(input());

    expect(result.kind).toBe('available');
    if (result.kind !== 'available') throw new Error('expected available config');
    expect(Object.keys(result).sort()).toEqual([
      'formalServerSessionKeyRing',
      'institutionGuardReferenceKeyRing',
      'kind',
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.formalServerSessionKeyRing).toEqual({
      currentKey: { keyVersion: 2, keyMaterial: FORMAL_CURRENT },
      verifyOnlyKeys: [
        {
          keyVersion: 1,
          keyMaterial: FORMAL_OLD,
          verifyUntil: '2026-07-22T13:00:00.000Z',
        },
      ],
    });
    expect(result.institutionGuardReferenceKeyRing).toEqual({
      currentIssueKey: { keyVersion: 1, keyMaterial: GUARD_CURRENT },
      verifyOnlyKeys: [],
    });
  });

  it.each([
    ['formal current version missing', { ZMTG_FORMAL_SESSION_HMAC_KEY_VERSION: undefined }],
    ['formal current key empty', { ZMTG_FORMAL_SESSION_HMAC_KEY_BASE64URL: '' }],
    ['formal current key noncanonical', { ZMTG_FORMAL_SESSION_HMAC_KEY_BASE64URL: `${encoded(FORMAL_CURRENT)}=` }],
    ['formal current key non-32-bytes', { ZMTG_FORMAL_SESSION_HMAC_KEY_BASE64URL: encoded(new Uint8Array(31)) }],
    ['formal key version noncanonical', { ZMTG_FORMAL_SESSION_HMAC_KEY_VERSION: '02' }],
    ['guard unsupported key version', { ZMTG_INSTITUTION_GUARD_HMAC_KEY_VERSION: '2' }],
    ['guard verify JSON malformed', { ZMTG_INSTITUTION_GUARD_HMAC_VERIFY_ONLY_JSON: '{' }],
    ['formal verify current duplicate', {
      ZMTG_FORMAL_SESSION_HMAC_VERIFY_ONLY_JSON: JSON.stringify([
        { keyVersion: 2, keyMaterialBase64Url: encoded(FORMAL_OLD), verifyUntil: '2026-07-22T13:00:00.000Z' },
      ]),
    }],
    ['formal verify not older', {
      ZMTG_FORMAL_SESSION_HMAC_VERIFY_ONLY_JSON: JSON.stringify([
        { keyVersion: 3, keyMaterialBase64Url: encoded(FORMAL_OLD), verifyUntil: '2026-07-22T13:00:00.000Z' },
      ]),
    }],
    ['verify timestamp noncanonical', {
      ZMTG_FORMAL_SESSION_HMAC_VERIFY_ONLY_JSON: JSON.stringify([
        { keyVersion: 1, keyMaterialBase64Url: encoded(FORMAL_OLD), verifyUntil: '2026-07-22T13:00:00Z' },
      ]),
    }],
    ['verify timestamp expired', {
      ZMTG_FORMAL_SESSION_HMAC_VERIFY_ONLY_JSON: JSON.stringify([
        { keyVersion: 1, keyMaterialBase64Url: encoded(FORMAL_OLD), verifyUntil: NOW.toISOString() },
      ]),
    }],
    ['verify JSON extra key', {
      ZMTG_FORMAL_SESSION_HMAC_VERIFY_ONLY_JSON: JSON.stringify([
        { keyVersion: 1, keyMaterialBase64Url: encoded(FORMAL_OLD), verifyUntil: '2026-07-22T13:00:00.000Z', extra: true },
      ]),
    }],
  ] as const)('%s fail-closes without echoing material', (_label, overrides) => {
    expectUnavailable(resolveInstitutionGuardRuntimeConfigV1(input({ environment: environment(overrides) })));
  });

  it('拒绝 environment extra key、accessor、Proxy 和 clock 异常', () => {
    const extra = { ...environment(), unexpected: 'value' };
    expectUnavailable(resolveInstitutionGuardRuntimeConfigV1(input({ environment: extra as never })));

    let getterReads = 0;
    const accessor = environment();
    Object.defineProperty(accessor, 'ZMTG_FORMAL_SESSION_HMAC_KEY_VERSION', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('environment getter must not run');
      },
    });
    expectUnavailable(resolveInstitutionGuardRuntimeConfigV1(input({ environment: accessor })));
    expect(getterReads).toBe(0);

    const proxy = new Proxy(environment(), {
      get() {
        throw new Error('environment proxy must not run');
      },
    });
    expectUnavailable(resolveInstitutionGuardRuntimeConfigV1(input({ environment: proxy })));
    expectUnavailable(resolveInstitutionGuardRuntimeConfigV1(input({ now: () => { throw new Error('clock'); } })));
    expectUnavailable(resolveInstitutionGuardRuntimeConfigV1(input({ now: () => new Date('invalid') })));
  });

  it('不包含 demo fallback、日志或默认 key', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(
        resolve(process.cwd(), 'src/modules/security/server/institution-guard-runtime-config.ts'),
        'utf8',
      ),
    );
    for (const forbidden of ['ZMTG_DEMO_SESSION_SECRET', 'zmtg_demo_session', 'console.', 'fallback']) {
      expect(source).not.toContain(forbidden);
    }
    for (const key of ENVIRONMENT_KEYS) expect(source).toContain(key);
  });
});
