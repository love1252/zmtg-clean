import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  createInstitutionGuardReferenceCodecV1,
  isInstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceOwnerSubjectV1,
} from '@/modules/security/server/institution-guard-reference';

const NOW = new Date('2026-07-22T08:00:00.000Z');
const KEY = new Uint8Array(32).fill(0x11);

function ownerSubject(value: string) {
  return value as InstitutionGuardReferenceOwnerSubjectV1;
}

function createCodec(input: {
  keyMaterial?: Uint8Array | null;
  now?: () => Date;
} = {}) {
  return createInstitutionGuardReferenceCodecV1({
    keyRing: {
      currentIssueKey: {
        keyVersion: 1,
        keyMaterial:
          input.keyMaterial === undefined ? KEY : input.keyMaterial,
      },
      verifyOnlyKeys: [],
    },
    now: input.now ?? (() => NOW),
  });
}

function input() {
  return {
    prefix: 'arv' as const,
    ownerDomain: 'security.institution-anchor',
    tenantId: 'tenant-zhengpu',
    institutionId: 'institution-zhengpu',
    ownerSubject: ownerSubject('revision-7'),
  };
}

function issuedReference() {
  const result = createCodec().issue(input());
  if (result.kind !== 'issued') throw new Error('expected issued fixture');
  return result.reference;
}

function readModuleSource() {
  return readFile(
    resolve(
      process.cwd(),
      'src/modules/security/server/institution-guard-reference.ts',
    ),
    'utf8',
  );
}

describe('guard reference hostile and low-sensitivity boundaries', () => {
  it('requires a nominal owner-local subject and exports no raw promotion helper', async () => {
    expectTypeOf<string>().not.toMatchTypeOf<
      InstitutionGuardReferenceOwnerSubjectV1
    >();

    const moduleExports = await import(
      '@/modules/security/server/institution-guard-reference'
    );
    expect(moduleExports).not.toHaveProperty('createOwnerSubject');
    expect(moduleExports).not.toHaveProperty('parseOwnerSubject');
    expect(moduleExports).not.toHaveProperty('canonicalizeGuardReference');
    expect(moduleExports).not.toHaveProperty('readKeyRing');
  });

  it('recognizes only factory-created handles without reading hostile values', () => {
    const authentic = createCodec();
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor = Object.defineProperty({}, 'issue', {
      enumerable: true,
      get() {
        getterReads += 1;
        return authentic.issue;
      },
    });
    const hostile = new Proxy(
      {},
      {
        get() {
          proxyTraps += 1;
          throw new Error('get trap must not run');
        },
        getPrototypeOf() {
          proxyTraps += 1;
          throw new Error('prototype trap must not run');
        },
        ownKeys() {
          proxyTraps += 1;
          throw new Error('ownKeys trap must not run');
        },
      },
    );
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();

    expect(Object.isFrozen(authentic)).toBe(true);
    expect(isInstitutionGuardReferenceCodecV1(authentic)).toBe(true);
    for (const value of [
      null,
      {},
      { issue: authentic.issue, verify: authentic.verify },
      { ...authentic },
      accessor,
      Object.create(authentic),
      hostile,
      revoked.proxy,
      authentic as unknown as Record<string, unknown>,
    ]) {
      const expected = value === authentic;
      expect(isInstitutionGuardReferenceCodecV1(value)).toBe(expected);
    }
    expect(
      isInstitutionGuardReferenceCodecV1(
        { ...authentic } as unknown as InstitutionGuardReferenceCodecV1,
      ),
    ).toBe(false);
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('returns an authentic unavailable handle for invalid factory dependencies', () => {
    let applyTraps = 0;
    const hostileNow = new Proxy(() => NOW, {
      apply() {
        applyTraps += 1;
        throw new Error('apply trap must not run');
      },
    });
    const codec = createInstitutionGuardReferenceCodecV1({
      keyRing: {
        currentIssueKey: { keyVersion: 1, keyMaterial: KEY },
        verifyOnlyKeys: [],
      },
      now: hostileNow,
    });

    expect(isInstitutionGuardReferenceCodecV1(codec)).toBe(true);
    expect(codec.issue(input())).toEqual({
      kind: 'unavailable',
      code: 'guard_reference_unavailable',
    });
    expect(codec.verify({ ...input(), reference: issuedReference() })).toEqual({
      kind: 'unavailable',
      code: 'guard_reference_unavailable',
    });
    expect(applyTraps).toBe(0);
  });

  it('returns only fixed low-sensitive outcomes and never echoes owner input or key material', () => {
    const rawPii = 'alice@example.com';
    const codec = createCodec();
    const issued = codec.issue({
      ...input(),
      ownerSubject: ownerSubject(rawPii),
    });

    expect(issued).toEqual({
      kind: 'unavailable',
      code: 'guard_reference_unavailable',
    });
    expect(JSON.stringify(issued)).not.toContain(rawPii);
    expect(JSON.stringify(issued)).not.toContain(Buffer.from(KEY).toString('hex'));

    const verified = codec.verify({
      ...input(),
      reference: 'arv_v1_k1_not-a-full-tag',
    });
    expect(verified).toEqual({
      kind: 'rejected',
      code: 'guard_reference_invalid',
    });
    expect(JSON.stringify(verified)).not.toContain('not-a-full-tag');
  });

  it('rejects short syntax candidates, malformed tags and noncanonical base64url', () => {
    const codec = createCodec();
    const valid = issuedReference();
    const malformed = [
      `arv_v1_k1_${'A'.repeat(22)}`,
      `arv_v1_k1_${'A'.repeat(42)}`,
      `arv_v1_k1_${'A'.repeat(44)}`,
      `arv_v1_k01_${'A'.repeat(43)}`,
      `arv_v1_k0_${'A'.repeat(43)}`,
      `arv_v1_k1000_${'A'.repeat(43)}`,
      `arv_v1_k1_${'A'.repeat(42)}+`,
      valid.replace(/^arv/u, 'mrv'),
      `${valid.slice(0, -1)}B`,
    ];

    for (const reference of malformed) {
      expect(codec.verify({ ...input(), reference })).toEqual({
        kind: 'rejected',
        code: 'guard_reference_invalid',
      });
    }
  });

  it('uses constant-time comparison for a canonical full-length wrong tag', async () => {
    const codec = createCodec();
    const reference = issuedReference();
    const tagStart = reference.lastIndexOf('_') + 1;
    const first = reference[tagStart];
    const changed = `${reference.slice(0, tagStart)}${first === 'A' ? 'B' : 'A'}${reference.slice(tagStart + 1)}`;

    expect(codec.verify({ ...input(), reference: changed })).toEqual({
      kind: 'rejected',
      code: 'guard_reference_invalid',
    });
    const source = await readModuleSource();
    expect(source).toMatch(
      /if \(!timingSafeEqual\(parsedReference\.tag, expectedTag\)\) return rejected;/u,
    );
  });

  it('maps HMAC and compare dependency failures to unavailable without details', async () => {
    const source = await readModuleSource();
    expect(source).toMatch(
      /function computeTag[\s\S]*?try \{[\s\S]*?createHmac[\s\S]*?\} catch \{\s*return null;\s*\}/u,
    );
    expect(source).toContain('if (!tag) return unavailable;');
    expect(source).toMatch(
      /try \{\s*if \(!timingSafeEqual[\s\S]*?\} catch \{\s*return unavailable;\s*\}/u,
    );
  });

  it('rejects extra, accessor, inherited, null-prototype and Proxy operation input', () => {
    let getterReads = 0;
    const accessor = { ...input() };
    Object.defineProperty(accessor, 'ownerSubject', {
      enumerable: true,
      get() {
        getterReads += 1;
        return ownerSubject('revision-7');
      },
    });
    const hostile = new Proxy(input(), {
      ownKeys() {
        throw new Error('hostile operation input');
      },
    });
    const codec = createCodec();

    for (const value of [
      { ...input(), role: 'tenant_admin' },
      accessor,
      Object.assign(Object.create({ inherited: true }), input()),
      Object.assign(Object.create(null), input()),
      new Proxy(input(), {}),
      hostile,
    ]) {
      expect(codec.issue(value as never)).toEqual({
        kind: 'unavailable',
        code: 'guard_reference_unavailable',
      });
    }
    expect(getterReads).toBe(0);
    expect(
      codec.issue({
        ...input(),
        tenantId: null,
      }),
    ).toEqual({
      kind: 'unavailable',
      code: 'guard_reference_unavailable',
    });
  });

  it('fails closed on malformed key-ring shape, duplicate versions and short keys', () => {
    let keyGetterReads = 0;
    const accessorCurrentKey = {
      keyVersion: 1,
      keyMaterial: KEY,
    };
    Object.defineProperty(accessorCurrentKey, 'keyMaterial', {
      enumerable: true,
      get() {
        keyGetterReads += 1;
        return KEY;
      },
    });
    const malformedRings = [
      {
        currentIssueKey: { keyVersion: 1, keyMaterial: new Uint8Array(31) },
        verifyOnlyKeys: [],
      },
      {
        currentIssueKey: { keyVersion: 1, keyMaterial: KEY },
        verifyOnlyKeys: [
          {
            keyVersion: 1,
            keyMaterial: KEY,
            verifyUntil: '2026-07-22T08:05:00.000Z',
          },
        ],
      },
      {
        currentIssueKey: { keyVersion: 0, keyMaterial: KEY },
        verifyOnlyKeys: [],
      },
      {
        currentIssueKey: { keyVersion: 1, keyMaterial: KEY, purpose: 'session' },
        verifyOnlyKeys: [],
      },
      {
        currentIssueKey: accessorCurrentKey,
        verifyOnlyKeys: [],
      },
      new Proxy(
        {
          currentIssueKey: { keyVersion: 1, keyMaterial: KEY },
          verifyOnlyKeys: [],
        },
        {},
      ),
    ];

    for (const keyRing of malformedRings) {
      const codec = createInstitutionGuardReferenceCodecV1({
        keyRing: keyRing as never,
        now: () => NOW,
      });
      expect(isInstitutionGuardReferenceCodecV1(codec)).toBe(true);
      expect(codec.issue(input())).toEqual({
        kind: 'unavailable',
        code: 'guard_reference_unavailable',
      });
      expect(codec.verify({ ...input(), reference: issuedReference() })).toEqual({
        kind: 'unavailable',
        code: 'guard_reference_unavailable',
      });
    }
    expect(keyGetterReads).toBe(0);
  });

  it('contains no environment, logger, transport, random or alternate-key fallback surface', async () => {
    const source = await readModuleSource();

    expect(source).toContain("from 'node:crypto'");
    expect(source).toContain('createHmac');
    expect(source).toContain('timingSafeEqual');
    for (const forbidden of [
      'process.env',
      'fetch(',
      'console.',
      'logger',
      'cookie',
      'webhook',
      'randomBytes',
      'secretEncryption',
      'ZMTG_',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
