import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  createFormalServerSessionProvenanceResolverV1,
  FORMAL_SERVER_SESSION_COOKIE_V1,
  type FormalServerSessionKeyRingV1,
} from '@/modules/auth/server/formal-server-session-provenance-owner';
import {
  isFormalProvenanceResolverV1,
} from '@/modules/security/server/formal-request-provenance-owner';
import type { FormalProvenanceResolverV1 } from '@/modules/security/server/institution-guard-evidence';
import { createInstitutionGuardReferenceCodecV1 } from '@/modules/security/server/institution-guard-reference';

const SESSION_KEY = new Uint8Array(32).fill(0x73);
const OLD_SESSION_KEY = new Uint8Array(32).fill(0x6f);
const REFERENCE_KEY = new Uint8Array(32).fill(0x72);
const VERIFIED_AT = new Date('2026-07-22T08:02:00.000Z');
const PROTOCOL_DOMAIN = 'zmtg.formal-server-session-cookie.v1';

const payload = Object.freeze({
  source: 'server_session' as const,
  sessionId: 'session-001',
  accountId: 'account-001',
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
  issuedAt: '2026-07-22T08:00:00.000Z',
  expiresAt: '2026-07-22T09:00:00.000Z',
});

function signToken(
  value: Record<string, unknown> = payload,
  input: Readonly<{
    keyVersion?: number;
    keyMaterial?: Uint8Array;
    rawPayload?: string;
  }> = {},
) {
  const keyVersion = input.keyVersion ?? 2;
  const payloadSegment =
    input.rawPayload ?? Buffer.from(JSON.stringify(value)).toString('base64url');
  const signingInput = `${PROTOCOL_DOMAIN}\n${keyVersion}\n${payloadSegment}`;
  const tag = createHmac('sha256', input.keyMaterial ?? SESSION_KEY)
    .update(signingInput)
    .digest('base64url');
  return `v1.k${keyVersion}.${payloadSegment}.${tag}`;
}

function keyRing(
  overrides: Partial<FormalServerSessionKeyRingV1> = {},
): FormalServerSessionKeyRingV1 {
  return {
    currentKey: { keyVersion: 2, keyMaterial: SESSION_KEY },
    verifyOnlyKeys: [
      {
        keyVersion: 1,
        keyMaterial: OLD_SESSION_KEY,
        verifyUntil: '2026-07-22T08:30:00.000Z',
      },
    ],
    ...overrides,
  };
}

function referenceCodec() {
  return createInstitutionGuardReferenceCodecV1({
    keyRing: {
      currentIssueKey: { keyVersion: 1, keyMaterial: REFERENCE_KEY },
      verifyOnlyKeys: [],
    },
    now: () => VERIFIED_AT,
  });
}

function resolver(input: Readonly<{
  cookieHeader?: string | null;
  sessionKeyRing?: FormalServerSessionKeyRingV1;
  now?: () => Date;
}> = {}): FormalProvenanceResolverV1 {
  const token = signToken();
  return createFormalServerSessionProvenanceResolverV1({
    cookieHeader:
      input.cookieHeader === undefined
        ? `${FORMAL_SERVER_SESSION_COOKIE_V1}=${token}`
        : input.cookieHeader,
    sessionKeyRing: input.sessionKeyRing ?? keyRing(),
    referenceCodec: referenceCodec(),
    now: input.now ?? (() => VERIFIED_AT),
  });
}

describe('AUTH-SESSION-01A formal server session provenance owner', () => {
  it('returns an authentic centrally registered, single-use resolver', async () => {
    const owner = resolver();

    expectTypeOf(owner).toEqualTypeOf<FormalProvenanceResolverV1>();
    expect(Object.isFrozen(owner)).toBe(true);
    expect(isFormalProvenanceResolverV1(owner)).toBe(true);
    expect((await owner.resolveCurrentRequest()).kind).toBe('verified');
    await expect(owner.resolveCurrentRequest()).resolves.toEqual({
      kind: 'rejected',
      code: 'provenance_source_denied',
    });
  });

  it('binds proof to session and generates a fresh internal request identifier', async () => {
    const first = await resolver().resolveCurrentRequest();
    const second = await resolver().resolveCurrentRequest();
    expect(first.kind).toBe('verified');
    expect(second.kind).toBe('verified');
    if (first.kind !== 'verified' || second.kind !== 'verified') return;

    expect(first.evidence.proofReference).toBe(second.evidence.proofReference);
    expect(first.evidence.requestReference).not.toBe(second.evidence.requestReference);
    expect(first.evidence.issuedAt).toBe('2026-07-22T08:02:00.000Z');
    expect(first.evidence.verifiedAt).toBe('2026-07-22T08:02:00.000Z');
    expect(first.evidence.validUntil).toBe('2026-07-22T08:07:00.000Z');
  });

  it('caps proof validity at the earlier session expiry or five-minute boundary', async () => {
    const shortToken = signToken({
      ...payload,
      expiresAt: '2026-07-22T08:03:00.000Z',
    });
    const result = await resolver({
      cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${shortToken}`,
    }).resolveCurrentRequest();
    expect(result.kind).toBe('verified');
    if (result.kind === 'verified') {
      expect(result.evidence.validUntil).toBe('2026-07-22T08:03:00.000Z');
    }
  });

  it('supports current and active verify-only keys while rejecting unknown or retired keys', async () => {
    const oldToken = signToken(payload, {
      keyVersion: 1,
      keyMaterial: OLD_SESSION_KEY,
    });
    expect(
      (
        await resolver({
          cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${oldToken}`,
        }).resolveCurrentRequest()
      ).kind,
    ).toBe('verified');

    for (const token of [
      signToken(payload, { keyVersion: 9 }),
      oldToken,
    ]) {
      const now = token === oldToken
        ? new Date('2026-07-22T08:30:00.000Z')
        : VERIFIED_AT;
      await expect(
        resolver({
          cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${token}`,
          now: () => now,
        }).resolveCurrentRequest(),
      ).resolves.toEqual({ kind: 'rejected', code: 'provenance_invalid' });
    }
  });

  it('fails the whole key ring closed unless every verify-only version is unique and older', async () => {
    for (const sessionKeyRing of [
      keyRing({
        currentKey: { keyVersion: 1, keyMaterial: SESSION_KEY },
        verifyOnlyKeys: [
          {
            keyVersion: 2,
            keyMaterial: OLD_SESSION_KEY,
            verifyUntil: '2026-07-22T08:30:00.000Z',
          },
        ],
      }),
      keyRing({
        verifyOnlyKeys: [
          {
            keyVersion: 1,
            keyMaterial: OLD_SESSION_KEY,
            verifyUntil: '2026-07-22T08:30:00.000Z',
          },
          {
            keyVersion: 1,
            keyMaterial: OLD_SESSION_KEY,
            verifyUntil: '2026-07-22T08:40:00.000Z',
          },
        ],
      }),
    ]) {
      await expect(resolver({ sessionKeyRing }).resolveCurrentRequest()).resolves.toEqual({
        kind: 'unavailable',
        code: 'provenance_unavailable',
      });
    }
  });

  it('maps missing and any demo/formal coexistence without decoding demo data', async () => {
    await expect(resolver({ cookieHeader: null }).resolveCurrentRequest()).resolves.toEqual({
      kind: 'rejected',
      code: 'provenance_missing',
    });
    await expect(
      resolver({ cookieHeader: 'zmtg_demo_session=hostile.demo.value' }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code: 'provenance_source_denied' });
    await expect(
      resolver({
        cookieHeader: `zmtg_demo_session=hostile.demo.value; ${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`,
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code: 'provenance_source_denied' });
  });

  it('treats every exact demo cookie-name trace as source denied without prefix guesses', async () => {
    const validFormal = `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`;
    for (const cookieHeader of [
      'zmtg_demo_session',
      '  zmtg_demo_session  ',
      'zmtg_demo_session=',
      `zmtg_demo_session; ${validFormal}`,
      `malformed; zmtg_demo_session ; ${FORMAL_SERVER_SESSION_COOKIE_V1}=invalid`,
      `zmtg_demo_session=; broken; ${validFormal}`,
      `broken; zmtg_demo_session; zmtg_demo_session=invalid; ${validFormal}`,
    ]) {
      await expect(resolver({ cookieHeader }).resolveCurrentRequest()).resolves.toEqual({
        kind: 'rejected',
        code: 'provenance_source_denied',
      });
    }

    for (const nearName of [
      'zmtg_demo_session_backup',
      'prefix_zmtg_demo_session',
      'zmtg_demo_sessionx',
    ]) {
      await expect(resolver({ cookieHeader: nearName }).resolveCurrentRequest()).resolves.toEqual({
        kind: 'rejected',
        code: 'provenance_missing',
      });
      expect(
        (
          await resolver({
            cookieHeader: `${nearName}; ${validFormal}`,
          }).resolveCurrentRequest()
        ).kind,
      ).toBe('verified');
    }
  });

  it('classifies missing and demo presence before key-ring, clock or codec validation', async () => {
    let keyGetterReads = 0;
    let codecTraps = 0;
    const hostileRing = {};
    Object.defineProperty(hostileRing, 'currentKey', {
      enumerable: true,
      get() {
        keyGetterReads += 1;
        throw new Error('key-ring secret');
      },
    });
    const hostileCodec = new Proxy(referenceCodec(), {
      getPrototypeOf() {
        codecTraps += 1;
        throw new Error('codec trap');
      },
      ownKeys() {
        codecTraps += 1;
        throw new Error('codec trap');
      },
    });
    const now = vi.fn(() => {
      throw new Error('clock secret');
    });

    for (const [cookieHeader, expected] of [
      [null, { kind: 'rejected', code: 'provenance_missing' }],
      [
        'zmtg_demo_session=not-even-a-token',
        { kind: 'rejected', code: 'provenance_source_denied' },
      ],
      [
        '  zmtg_demo_session  ',
        { kind: 'rejected', code: 'provenance_source_denied' },
      ],
      [
        `zmtg_demo_session=not-even-a-token; ${FORMAL_SERVER_SESSION_COOKIE_V1}=invalid`,
        { kind: 'rejected', code: 'provenance_source_denied' },
      ],
      [
        `broken; zmtg_demo_session ; ${FORMAL_SERVER_SESSION_COOKIE_V1}=invalid`,
        { kind: 'rejected', code: 'provenance_source_denied' },
      ],
    ] as const) {
      const result = await createFormalServerSessionProvenanceResolverV1({
        cookieHeader,
        sessionKeyRing: hostileRing as never,
        referenceCodec: hostileCodec,
        now,
      }).resolveCurrentRequest();
      expect(result).toEqual(expected);
    }
    expect(keyGetterReads).toBe(0);
    expect(codecTraps).toBe(0);
    expect(now).not.toHaveBeenCalled();
  });

  it('rejects forged, tampered, noncanonical, duplicate and oversized cookies', async () => {
    const canonicalPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const noncanonical = signToken(payload, {
      rawPayload: Buffer.from(` ${JSON.stringify(payload)}`).toString('base64url'),
    });
    const valid = signToken();
    const cases = [
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken(payload, { keyMaterial: OLD_SESSION_KEY })}`,
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${valid.slice(0, -1)}A`,
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${noncanonical}`,
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=v1.k2.${canonicalPayload}=.${'A'.repeat(43)}`,
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${valid}; ${FORMAL_SERVER_SESSION_COOKIE_V1}=${valid}`,
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${'x'.repeat(4097)}`,
    ];
    for (const cookieHeader of cases) {
      await expect(resolver({ cookieHeader }).resolveCurrentRequest()).resolves.toEqual({
        kind: 'rejected',
        code: 'provenance_invalid',
      });
    }
  });

  it('rejects extra, missing, wrong-source, unsafe-id and invalid-time payloads', async () => {
    const cases: Record<string, unknown>[] = [
      { ...payload, role: 'tenant_admin' },
      Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'accountId')),
      { ...payload, source: 'demo_session' },
      { ...payload, sessionId: 'alice@example.com' },
      { ...payload, tenantId: 'tenant/unsafe' },
      { ...payload, issuedAt: '2026-07-22T08:00:00Z' },
      { ...payload, issuedAt: '2026-07-22T08:03:00.000Z' },
      { ...payload, expiresAt: '2026-07-22T08:00:00.000Z' },
      { ...payload, expiresAt: '2026-07-23T08:00:00.001Z' },
    ];
    for (const value of cases) {
      await expect(
        resolver({
          cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken(value)}`,
        }).resolveCurrentRequest(),
      ).resolves.toEqual({ kind: 'rejected', code: 'provenance_invalid' });
    }
  });

  it('distinguishes expiry at the exact boundary', async () => {
    const expiredToken = signToken({
      ...payload,
      expiresAt: '2026-07-22T08:02:00.000Z',
    });
    await expect(
      resolver({
        cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${expiredToken}`,
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code: 'provenance_expired' });
  });

  it('maps known missing material, invalid key-ring, clock and codec failures to unavailable', async () => {
    const missingMaterial = keyRing({
      currentKey: { keyVersion: 2, keyMaterial: null },
    });
    const duplicateVersion = keyRing({
      verifyOnlyKeys: [
        {
          keyVersion: 2,
          keyMaterial: OLD_SESSION_KEY,
          verifyUntil: '2026-07-22T08:30:00.000Z',
        },
      ],
    });
    for (const sessionKeyRing of [missingMaterial, duplicateVersion]) {
      await expect(resolver({ sessionKeyRing }).resolveCurrentRequest()).resolves.toEqual({
        kind: 'unavailable',
        code: 'provenance_unavailable',
      });
    }
    await expect(
      resolver({
        now: () => {
          throw new Error('clock secret');
        },
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'unavailable', code: 'provenance_unavailable' });
  });

  it('rejects unknown keys before clock use but treats a known missing key as unavailable', async () => {
    const now = vi.fn(() => {
      throw new Error('clock must not run');
    });
    const unknown = signToken(payload, { keyVersion: 9 });
    await expect(
      resolver({
        cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${unknown}`,
        now,
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code: 'provenance_invalid' });
    expect(now).not.toHaveBeenCalled();

    const knownWithoutMaterial = keyRing({
      currentKey: { keyVersion: 2, keyMaterial: null },
    });
    await expect(
      resolver({
        sessionKeyRing: knownWithoutMaterial,
        now,
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'unavailable', code: 'provenance_unavailable' });
    expect(now).toHaveBeenCalledTimes(1);
  });

  it('rejects a retired verify-only key before checking its missing material', async () => {
    const oldToken = signToken(payload, {
      keyVersion: 1,
      keyMaterial: OLD_SESSION_KEY,
    });
    const ringWithMissingOldMaterial = keyRing({
      verifyOnlyKeys: [
        {
          keyVersion: 1,
          keyMaterial: null,
          verifyUntil: '2026-07-22T08:30:00.000Z',
        },
      ],
    });
    await expect(
      resolver({
        cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${oldToken}`,
        sessionKeyRing: ringWithMissingOldMaterial,
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'unavailable', code: 'provenance_unavailable' });
    await expect(
      resolver({
        cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${oldToken}`,
        sessionKeyRing: ringWithMissingOldMaterial,
        now: () => new Date('2026-07-22T08:30:00.000Z'),
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code: 'provenance_invalid' });
  });

  it('rejects hostile key rings and codecs without invoking getters or Proxy traps', async () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const accessorRing = keyRing() as Record<string, unknown>;
    Object.defineProperty(accessorRing, 'currentKey', {
      enumerable: true,
      get() {
        getterReads += 1;
        return { keyVersion: 2, keyMaterial: SESSION_KEY };
      },
    });
    const proxyRing = new Proxy(keyRing(), {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('key-ring trap');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('key-ring trap');
      },
    });
    const proxyCodec = new Proxy(referenceCodec(), {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('codec trap');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('codec trap');
      },
    });

    for (const sessionKeyRing of [accessorRing, proxyRing]) {
      await expect(
        createFormalServerSessionProvenanceResolverV1({
          cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`,
          sessionKeyRing: sessionKeyRing as never,
          referenceCodec: referenceCodec(),
          now: () => VERIFIED_AT,
        }).resolveCurrentRequest(),
      ).resolves.toEqual({ kind: 'unavailable', code: 'provenance_unavailable' });
    }
    await expect(
      createFormalServerSessionProvenanceResolverV1({
        cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`,
        sessionKeyRing: keyRing(),
        referenceCodec: proxyCodec,
        now: () => VERIFIED_AT,
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'unavailable', code: 'provenance_unavailable' });
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('copies key material before caller mutation', async () => {
    const mutableKey = Uint8Array.from(SESSION_KEY);
    const owner = resolver({
      sessionKeyRing: keyRing({
        currentKey: { keyVersion: 2, keyMaterial: mutableKey },
      }),
    });
    mutableKey.fill(0);
    expect((await owner.resolveCurrentRequest()).kind).toBe('verified');
  });

  it('snapshots exact inputs without invoking accessors or Proxy traps', async () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor = {
      cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`,
      sessionKeyRing: keyRing(),
      referenceCodec: referenceCodec(),
      now: () => VERIFIED_AT,
    };
    Object.defineProperty(accessor, 'cookieHeader', {
      enumerable: true,
      get() {
        getterReads += 1;
        return null;
      },
    });
    const proxy = new Proxy({
      cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`,
      sessionKeyRing: keyRing(),
      referenceCodec: referenceCodec(),
      now: () => VERIFIED_AT,
    }, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('hostile input');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('hostile input');
      },
    });
    for (const input of [accessor, proxy]) {
      const result = await createFormalServerSessionProvenanceResolverV1(
        input as never,
      ).resolveCurrentRequest();
      expect(result).toEqual({ kind: 'unavailable', code: 'provenance_unavailable' });
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('returns frozen low-sensitive decisions and never exposes raw session facts or keys', async () => {
    const result = await resolver().resolveCurrentRequest();
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind === 'verified') expect(Object.isFrozen(result.evidence)).toBe(true);
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      payload.sessionId,
      payload.accountId,
      Buffer.from(SESSION_KEY).toString('hex'),
      'tenant_admin',
      'email',
      'phone',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('has no demo decoder, environment, route, database or external surface', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'src/modules/auth/server/formal-server-session-provenance-owner.ts'),
      'utf8',
    );
    for (const forbidden of [
      'process.env',
      'ZMTG_DEMO_SESSION_SECRET',
      'decodeDemoSession',
      'inertReferenceCodec',
      "from 'next/",
      'fetch(',
      'drizzle',
      'DATABASE_URL',
      'role:',
      'membership',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
