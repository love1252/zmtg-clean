import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  createFormalRequestProvenanceResolverFromOwnerResolutionV1,
  createFormalRequestProvenanceResolverV1,
  isFormalProvenanceResolverV1,
  type FormalRequestProvenanceOwnerInputV1,
} from '@/modules/security/server/formal-request-provenance-owner';
import {
  parseRequestProvenanceEvidenceCandidateV1,
  type FormalProvenanceResolverV1,
  type InstitutionGuardReferencePrefixV1,
  type ProvenanceResolutionV1,
} from '@/modules/security/server/institution-guard-evidence';
import {
  createInstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceInputV1,
} from '@/modules/security/server/institution-guard-reference';

const KEY = new Uint8Array(32).fill(0x61);
const VERIFIED_AT = new Date('2026-07-22T08:02:00.000Z');

type Unbranded<T> = {
  [Key in keyof T as Key extends symbol ? never : Key]: T[Key];
};

function ownerInput(
  overrides: Record<string, unknown> = {},
): FormalRequestProvenanceOwnerInputV1 {
  return {
    source: 'server_session',
    accountId: 'account-001',
    tenantId: 'tenant-001',
    institutionId: 'institution-001',
    requestIdentifier: 'request-001',
    proofIdentifier: 'proof-001',
    issuedAt: '2026-07-22T08:00:00.000Z',
    proofValidUntil: '2026-07-22T08:04:00.000Z',
    ...overrides,
  } as unknown as FormalRequestProvenanceOwnerInputV1;
}

function realCodec() {
  return createInstitutionGuardReferenceCodecV1({
    keyRing: {
      currentIssueKey: { keyVersion: 1, keyMaterial: KEY },
      verifyOnlyKeys: [],
    },
    now: () => VERIFIED_AT,
  });
}

function recordingCodec(input: {
  failAt?: number;
  throwAt?: number;
} = {}) {
  const actual = realCodec();
  const calls: InstitutionGuardReferenceInputV1<InstitutionGuardReferencePrefixV1>[] = [];
  const issue = vi.fn(
    <Prefix extends InstitutionGuardReferencePrefixV1>(
      value: InstitutionGuardReferenceInputV1<Prefix>,
    ) => {
      calls.push(value);
      const call = calls.length;
      if (input.throwAt === call) throw new Error('secret dependency detail');
      if (input.failAt === call) {
        return {
          kind: 'unavailable',
          code: 'guard_reference_unavailable',
        } as const;
      }
      return actual.issue(value);
    },
  );
  return {
    calls,
    issue,
    codec: {
      issue,
      verify: actual.verify,
    } as unknown as InstitutionGuardReferenceCodecV1,
  };
}

function profileViolatingCodec(input: {
  targetCall: 1 | 2 | 3;
  reference: (prefix: 'usr' | 'req' | 'prf') => string;
}) {
  const actual = realCodec();
  let call = 0;
  const issue = vi.fn(
    <Prefix extends InstitutionGuardReferencePrefixV1>(
      value: InstitutionGuardReferenceInputV1<Prefix>,
    ) => {
      call += 1;
      if (call === input.targetCall) {
        return {
          kind: 'issued',
          reference: input.reference(value.prefix as 'usr' | 'req' | 'prf'),
        } as never;
      }
      return actual.issue(value);
    },
  );
  return {
    issue,
    codec: {
      issue,
      verify: actual.verify,
    } as unknown as InstitutionGuardReferenceCodecV1,
  };
}

function resolver(input: {
  ownerInput?: FormalRequestProvenanceOwnerInputV1 | null;
  codec?: InstitutionGuardReferenceCodecV1;
  now?: () => Date;
} = {}): FormalProvenanceResolverV1 {
  return createFormalRequestProvenanceResolverV1({
    ownerInput:
      input.ownerInput === undefined ? ownerInput() : input.ownerInput,
    referenceCodec: input.codec ?? realCodec(),
    now: input.now ?? (() => VERIFIED_AT),
  });
}

async function verifiedEvidence(input: {
  ownerInput?: FormalRequestProvenanceOwnerInputV1;
  codec?: InstitutionGuardReferenceCodecV1;
  now?: () => Date;
} = {}) {
  const result = await resolver(input).resolveCurrentRequest();
  expect(result.kind).toBe('verified');
  if (result.kind !== 'verified') throw new Error('expected verified evidence');
  return result.evidence;
}

describe('BASE-02B formal request provenance owner', () => {
  it('maps an explicit upstream owner resolution without malformed-field sentinels', async () => {
    const cases = [
      {
        ownerResolution: { kind: 'rejected', code: 'provenance_missing' },
        expected: { kind: 'rejected', code: 'provenance_missing' },
      },
      {
        ownerResolution: { kind: 'rejected', code: 'provenance_source_denied' },
        expected: { kind: 'rejected', code: 'provenance_source_denied' },
      },
      {
        ownerResolution: { kind: 'rejected', code: 'provenance_invalid' },
        expected: { kind: 'rejected', code: 'provenance_invalid' },
      },
      {
        ownerResolution: { kind: 'rejected', code: 'provenance_expired' },
        expected: { kind: 'rejected', code: 'provenance_expired' },
      },
      {
        ownerResolution: { kind: 'unavailable', code: 'provenance_unavailable' },
        expected: { kind: 'unavailable', code: 'provenance_unavailable' },
      },
    ] as const;

    for (const value of cases) {
      const result = await createFormalRequestProvenanceResolverFromOwnerResolutionV1({
        ownerResolution: value.ownerResolution,
      }).resolveCurrentRequest();
      expect(result).toEqual(value.expected);
      expect(Object.isFrozen(result)).toBe(true);
    }
  });

  it('keeps explicit owner resolution single-use and exact', async () => {
    const owner = createFormalRequestProvenanceResolverFromOwnerResolutionV1({
      ownerResolution: { kind: 'verified', ownerInput: ownerInput() },
      referenceCodec: realCodec(),
      now: () => VERIFIED_AT,
    });
    expect(isFormalProvenanceResolverV1(owner)).toBe(true);
    expect((await owner.resolveCurrentRequest()).kind).toBe('verified');
    await expect(owner.resolveCurrentRequest()).resolves.toEqual({
      kind: 'rejected',
      code: 'provenance_source_denied',
    });

    await expect(
      createFormalRequestProvenanceResolverFromOwnerResolutionV1({
        ownerResolution: {
          kind: 'rejected',
          code: 'provenance_missing',
          rawSession: 'must-not-be-accepted',
        } as never,
        referenceCodec: realCodec(),
        now: () => VERIFIED_AT,
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'unavailable', code: 'provenance_unavailable' });
  });

  it('keeps the request-bound owner input and resolver nominally sealed', () => {
    expectTypeOf<Unbranded<FormalRequestProvenanceOwnerInputV1>>().not.toMatchTypeOf<
      FormalRequestProvenanceOwnerInputV1
    >();
    expectTypeOf<ReturnType<typeof createFormalRequestProvenanceResolverV1>>()
      .toEqualTypeOf<FormalProvenanceResolverV1>();
    expectTypeOf<FormalProvenanceResolverV1['resolveCurrentRequest']>()
      .returns.toEqualTypeOf<Promise<ProvenanceResolutionV1>>();
  });

  it('authenticates only factory-created resolver handles without reading lookalikes', () => {
    const genuine = resolver();
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor = {};
    Object.defineProperty(accessor, 'resolveCurrentRequest', {
      enumerable: true,
      get() {
        getterReads += 1;
        return genuine.resolveCurrentRequest;
      },
    });
    const customPrototype = Object.assign(
      Object.create({ owner: 'lookalike' }),
      { resolveCurrentRequest: genuine.resolveCurrentRequest },
    );
    const proxy = new Proxy(
      { resolveCurrentRequest: genuine.resolveCurrentRequest },
      {
        get() {
          proxyTraps += 1;
          throw new Error('lookalike getter trap');
        },
        getPrototypeOf() {
          proxyTraps += 1;
          throw new Error('lookalike prototype trap');
        },
        ownKeys() {
          proxyTraps += 1;
          throw new Error('lookalike ownKeys trap');
        },
      },
    );
    const revoked = Proxy.revocable(
      { resolveCurrentRequest: genuine.resolveCurrentRequest },
      {
        get() {
          proxyTraps += 1;
          throw new Error('revoked getter trap');
        },
      },
    );
    revoked.revoke();

    expect(Object.isFrozen(genuine)).toBe(true);
    expect(isFormalProvenanceResolverV1(genuine)).toBe(true);
    for (const value of [
      {},
      { resolveCurrentRequest: genuine.resolveCurrentRequest },
      Object.freeze({ ...genuine }),
      {
        resolveCurrentRequest: genuine.resolveCurrentRequest,
      } as unknown as FormalProvenanceResolverV1,
      customPrototype,
      Object.assign(Object.create(null), {
        resolveCurrentRequest: genuine.resolveCurrentRequest,
      }),
      accessor,
      proxy,
      revoked.proxy,
    ]) {
      expect(isFormalProvenanceResolverV1(value)).toBe(false);
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('keeps an invalid-dependency factory handle authentic while resolution fails closed', async () => {
    const owner = createFormalRequestProvenanceResolverV1({
      ownerInput: ownerInput(),
      referenceCodec: {
        issue: 'not-a-function',
        verify: 'not-a-function',
      } as never,
      now: () => VERIFIED_AT,
    });

    expect(Object.isFrozen(owner)).toBe(true);
    expect(isFormalProvenanceResolverV1(owner)).toBe(true);
    await expect(owner.resolveCurrentRequest()).resolves.toEqual({
      kind: 'unavailable',
      code: 'provenance_unavailable',
    });
  });

  it('exports no raw owner-input promotion helper', async () => {
    const moduleExports = await import(
      '@/modules/security/server/formal-request-provenance-owner'
    );
    expect(moduleExports).not.toHaveProperty('createOwnerInput');
    expect(moduleExports).not.toHaveProperty('parseOwnerInput');
    expect(moduleExports).not.toHaveProperty('readAuthentication');
    for (const forbidden of [
      'registerFormalProvenanceResolverV1',
      'rehydrateFormalProvenanceResolverV1',
      'promoteFormalProvenanceResolverV1',
      'authenticFormalProvenanceResolvers',
    ]) {
      expect(moduleExports).not.toHaveProperty(forbidden);
    }
  });

  it('issues the fixed global user profile and source-bound institution request profiles', async () => {
    const codec = realCodec();
    const server = await verifiedEvidence({ codec });
    const gateway = await verifiedEvidence({
      ownerInput: ownerInput({
        source: 'trusted_gateway',
        requestIdentifier: 'request-gateway-001',
        proofIdentifier: 'proof-gateway-001',
      }),
      codec,
    });

    const expectedServerReferences = [
      codec.issue({
        prefix: 'usr',
        ownerDomain: 'zmtg.auth-account.v1',
        tenantId: null,
        institutionId: null,
        ownerSubject: 'account-001' as never,
      }),
      codec.issue({
        prefix: 'req',
        ownerDomain: 'zmtg.formal-provenance.server-session.v1',
        tenantId: 'tenant-001',
        institutionId: 'institution-001',
        ownerSubject: 'request-001' as never,
      }),
      codec.issue({
        prefix: 'prf',
        ownerDomain: 'zmtg.formal-provenance.server-session.v1',
        tenantId: 'tenant-001',
        institutionId: 'institution-001',
        ownerSubject: 'proof-001' as never,
      }),
    ];
    const expectedGatewayReferences = [
      codec.issue({
        prefix: 'req',
        ownerDomain: 'zmtg.formal-provenance.trusted-gateway.v1',
        tenantId: 'tenant-001',
        institutionId: 'institution-001',
        ownerSubject: 'request-gateway-001' as never,
      }),
      codec.issue({
        prefix: 'prf',
        ownerDomain: 'zmtg.formal-provenance.trusted-gateway.v1',
        tenantId: 'tenant-001',
        institutionId: 'institution-001',
        ownerSubject: 'proof-gateway-001' as never,
      }),
    ];
    expect(expectedServerReferences.every((value) => value.kind === 'issued')).toBe(true);
    expect(expectedGatewayReferences.every((value) => value.kind === 'issued')).toBe(true);
    expect(server.userReference).toBe(
      expectedServerReferences[0]?.kind === 'issued'
        ? expectedServerReferences[0].reference
        : null,
    );
    expect(server.requestReference).toBe(
      expectedServerReferences[1]?.kind === 'issued'
        ? expectedServerReferences[1].reference
        : null,
    );
    expect(server.proofReference).toBe(
      expectedServerReferences[2]?.kind === 'issued'
        ? expectedServerReferences[2].reference
        : null,
    );
    expect(gateway.requestReference).toBe(
      expectedGatewayReferences[0]?.kind === 'issued'
        ? expectedGatewayReferences[0].reference
        : null,
    );
    expect(gateway.proofReference).toBe(
      expectedGatewayReferences[1]?.kind === 'issued'
        ? expectedGatewayReferences[1].reference
        : null,
    );
    expect(server.userReference).toBe(gateway.userReference);
    expect(server.requestReference).not.toBe(gateway.requestReference);
    expect(server.proofReference).not.toBe(gateway.proofReference);
    expect(parseRequestProvenanceEvidenceCandidateV1(server)).toEqual(server);
    expect(parseRequestProvenanceEvidenceCandidateV1(gateway)).toEqual(gateway);
  });

  it('keeps a user stable across institution scope while separating different accounts', async () => {
    const first = await verifiedEvidence();
    const anotherScope = await verifiedEvidence({
      ownerInput: ownerInput({
        tenantId: 'tenant-002',
        institutionId: 'institution-002',
      }),
    });
    const anotherAccount = await verifiedEvidence({
      ownerInput: ownerInput({ accountId: 'account-002' }),
    });

    expect(first.userReference).toBe(anotherScope.userReference);
    expect(first.userReference).not.toBe(anotherAccount.userReference);
    expect(first.requestReference).not.toBe(anotherScope.requestReference);
    expect(first.proofReference).not.toBe(anotherScope.proofReference);
  });

  it('uses trusted now once and caps validity at the earlier proof or five-minute boundary', async () => {
    const proofFirstNow = vi.fn(() => VERIFIED_AT);
    const proofFirst = await verifiedEvidence({ now: proofFirstNow });
    expect(proofFirstNow).toHaveBeenCalledTimes(1);
    expect(proofFirst.verifiedAt).toBe('2026-07-22T08:02:00.000Z');
    expect(proofFirst.validUntil).toBe('2026-07-22T08:04:00.000Z');

    const capFirst = await verifiedEvidence({
      ownerInput: ownerInput({
        proofValidUntil: '2026-07-22T08:10:00.000Z',
      }),
    });
    expect(capFirst.validUntil).toBe('2026-07-22T08:05:00.000Z');
  });

  it('accepts the last millisecond but expires exactly at either validity boundary', async () => {
    const justBefore = await resolver({
      now: () => new Date('2026-07-22T08:03:59.999Z'),
    }).resolveCurrentRequest();
    expect(justBefore.kind).toBe('verified');

    expect(
      await resolver({
        now: () => new Date('2026-07-22T08:04:00.000Z'),
      }).resolveCurrentRequest(),
    ).toEqual({ kind: 'rejected', code: 'provenance_expired' });
    expect(
      await resolver({
        ownerInput: ownerInput({
          proofValidUntil: '2026-07-22T08:10:00.000Z',
        }),
        now: () => new Date('2026-07-22T08:05:00.000Z'),
      }).resolveCurrentRequest(),
    ).toEqual({ kind: 'rejected', code: 'provenance_expired' });
  });

  it('maps missing, unsupported source, malformed evidence, future issue and expiry precisely', async () => {
    expect(
      await resolver({ ownerInput: null }).resolveCurrentRequest(),
    ).toEqual({ kind: 'rejected', code: 'provenance_missing' });
    expect(
      await resolver({
        ownerInput: ownerInput({ source: 'demo_session' }),
      }).resolveCurrentRequest(),
    ).toEqual({ kind: 'rejected', code: 'provenance_source_denied' });

    for (const malformed of [
      ownerInput({ accountId: 'alice@example.com' }),
      ownerInput({ tenantId: '' }),
      ownerInput({ requestIdentifier: 'request/unsafe' }),
      ownerInput({ issuedAt: '2026-07-22T08:00:00Z' }),
      ownerInput({ proofValidUntil: '2026-07-22T08:00:00.000Z' }),
    ]) {
      expect(
        await resolver({ ownerInput: malformed }).resolveCurrentRequest(),
      ).toEqual({ kind: 'rejected', code: 'provenance_invalid' });
    }

    expect(
      await resolver({
        ownerInput: ownerInput({ issuedAt: '2026-07-22T08:03:00.000Z' }),
      }).resolveCurrentRequest(),
    ).toEqual({ kind: 'rejected', code: 'provenance_invalid' });
    expect(
      await resolver({
        now: () => new Date('2026-07-22T08:06:00.000Z'),
      }).resolveCurrentRequest(),
    ).toEqual({ kind: 'rejected', code: 'provenance_expired' });
  });

  it('consumes a request-bound resolver once and never reuses its proof', async () => {
    const now = vi.fn(() => VERIFIED_AT);
    const owner = resolver({ now });

    expect((await owner.resolveCurrentRequest()).kind).toBe('verified');
    expect(await owner.resolveCurrentRequest()).toEqual({
      kind: 'rejected',
      code: 'provenance_source_denied',
    });
    expect(now).toHaveBeenCalledTimes(1);
  });

  it('maps clock and codec dependency failure to unavailable without partial evidence', async () => {
    for (const now of [
      () => {
        throw new Error('clock secret');
      },
      () => new Date(Number.NaN),
    ]) {
      expect(await resolver({ now }).resolveCurrentRequest()).toEqual({
        kind: 'unavailable',
        code: 'provenance_unavailable',
      });
    }

    for (const failure of [{ failAt: 1 }, { failAt: 2 }, { failAt: 3 }, { throwAt: 2 }]) {
      const recorder = recordingCodec(failure);
      const result = await resolver({ codec: recorder.codec }).resolveCurrentRequest();
      expect(result).toEqual({
        kind: 'unavailable',
        code: 'provenance_unavailable',
      });
      expect(JSON.stringify(result)).not.toContain('account-001');
      expect(recorder.calls.length).toBeLessThanOrEqual(failure.failAt ?? failure.throwAt ?? 3);
    }
  });

  it('rejects every structural codec lookalike before it can supply a reference', async () => {
    const wrongPrefix = {
      usr: 'req',
      req: 'prf',
      prf: 'req',
    } as const;
    const profiles = [
      (prefix: 'usr' | 'req' | 'prf') =>
        `${prefix}_v1_k1_${'A'.repeat(22)}`,
      (prefix: 'usr' | 'req' | 'prf') =>
        `${wrongPrefix[prefix]}_v1_k1_${'A'.repeat(43)}`,
      (prefix: 'usr' | 'req' | 'prf') =>
        `${prefix}_v1_k2_${'A'.repeat(43)}`,
    ];

    for (const targetCall of [1, 2, 3] as const) {
      for (const reference of profiles) {
        const hostile = profileViolatingCodec({ targetCall, reference });
        const result = await resolver({
          codec: hostile.codec,
        }).resolveCurrentRequest();

        expect(result).toEqual({
          kind: 'unavailable',
          code: 'provenance_unavailable',
        });
        expect(hostile.issue).not.toHaveBeenCalled();
        expect(JSON.stringify(result)).not.toContain('evidence');
        expect(JSON.stringify(result)).not.toContain('account-001');
        expect(JSON.stringify(result)).not.toContain('request-001');
        expect(JSON.stringify(result)).not.toContain('proof-001');
      }
    }
  });

  it('does not trigger hostile owner input getters or Proxy traps', async () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor = { ...ownerInput() } as Record<string, unknown>;
    Object.defineProperty(accessor, 'accountId', {
      enumerable: true,
      get() {
        getterReads += 1;
        return 'account-001';
      },
    });
    const hostileProxy = new Proxy(
      { ...ownerInput() },
      {
        getPrototypeOf() {
          proxyTraps += 1;
          throw new Error('hostile owner input');
        },
        ownKeys() {
          proxyTraps += 1;
          throw new Error('hostile owner input');
        },
      },
    );
    const recorder = recordingCodec();

    for (const value of [accessor, hostileProxy]) {
      expect(
        await resolver({
          ownerInput: value as unknown as FormalRequestProvenanceOwnerInputV1,
          codec: recorder.codec,
        }).resolveCurrentRequest(),
      ).toEqual({ kind: 'rejected', code: 'provenance_invalid' });
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
    expect(recorder.issue).not.toHaveBeenCalled();
  });

  it('does not trigger hostile composer getters or Proxy traps', async () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const accessorComposer = {
      ownerInput: ownerInput(),
      referenceCodec: realCodec(),
      now: () => VERIFIED_AT,
    };
    Object.defineProperty(accessorComposer, 'ownerInput', {
      enumerable: true,
      get() {
        getterReads += 1;
        return ownerInput();
      },
    });
    const proxyComposer = new Proxy(
      {
        ownerInput: ownerInput(),
        referenceCodec: realCodec(),
        now: () => VERIFIED_AT,
      },
      {
        getPrototypeOf() {
          proxyTraps += 1;
          throw new Error('hostile composer');
        },
        ownKeys() {
          proxyTraps += 1;
          throw new Error('hostile composer');
        },
      },
    );

    for (const value of [accessorComposer, proxyComposer]) {
      const result = await createFormalRequestProvenanceResolverV1(
        value as never,
      ).resolveCurrentRequest();
      expect(result).toEqual({
        kind: 'unavailable',
        code: 'provenance_unavailable',
      });
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('rejects malformed or Proxy codec methods without reading accessors or invoking traps', async () => {
    const actual = realCodec();
    let getterReads = 0;
    let proxyTraps = 0;
    const accessorCodec = {
      issue: actual.issue,
      verify: actual.verify,
    };
    Object.defineProperty(accessorCodec, 'verify', {
      enumerable: true,
      get() {
        getterReads += 1;
        return actual.verify;
      },
    });
    const proxyVerify = new Proxy(actual.verify, {
      apply() {
        proxyTraps += 1;
        throw new Error('hostile verify method');
      },
    });
    const malformedCodecs = [
      { issue: actual.issue, verify: 'not-a-function' },
      { issue: actual.issue, verify: proxyVerify },
      accessorCodec,
    ];

    for (const referenceCodec of malformedCodecs) {
      const now = vi.fn(() => VERIFIED_AT);
      expect(
        await createFormalRequestProvenanceResolverV1({
          ownerInput: ownerInput(),
          referenceCodec: referenceCodec as never,
          now,
        }).resolveCurrentRequest(),
      ).toEqual({
        kind: 'unavailable',
        code: 'provenance_unavailable',
      });
      expect(now).not.toHaveBeenCalled();
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('accepts only genuine codec handles and rejects lookalikes without property reads', async () => {
    const genuine = realCodec();
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor = {};
    Object.defineProperties(accessor, {
      issue: {
        enumerable: true,
        get() {
          getterReads += 1;
          return genuine.issue;
        },
      },
      verify: {
        enumerable: true,
        get() {
          getterReads += 1;
          return genuine.verify;
        },
      },
    });
    const customPrototype = Object.assign(
      Object.create({ codec: 'lookalike' }),
      { issue: genuine.issue, verify: genuine.verify },
    );
    const proxy = new Proxy(genuine, {
      get() {
        proxyTraps += 1;
        throw new Error('codec getter trap');
      },
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('codec prototype trap');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('codec ownKeys trap');
      },
    });
    const revoked = Proxy.revocable(genuine, {
      get() {
        proxyTraps += 1;
        throw new Error('revoked codec trap');
      },
    });
    revoked.revoke();

    for (const referenceCodec of [
      { issue: genuine.issue, verify: genuine.verify },
      { ...genuine },
      {
        issue: genuine.issue,
        verify: genuine.verify,
      } as unknown as InstitutionGuardReferenceCodecV1,
      customPrototype,
      accessor,
      proxy,
      revoked.proxy,
    ]) {
      const now = vi.fn(() => VERIFIED_AT);
      await expect(
        resolver({
          codec: referenceCodec as InstitutionGuardReferenceCodecV1,
          now,
        }).resolveCurrentRequest(),
      ).resolves.toEqual({
        kind: 'unavailable',
        code: 'provenance_unavailable',
      });
      expect(now).not.toHaveBeenCalled();
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('rejects caller-selected domains, verified time or validity projection before issuing', async () => {
    for (const injected of [
      ownerInput({ ownerDomain: 'caller.domain' }),
      ownerInput({ verifiedAt: '2026-07-22T08:02:00.000Z' }),
      ownerInput({ validUntil: '2026-07-22T08:04:00.000Z' }),
    ]) {
      const recorder = recordingCodec();
      expect(
        await resolver({
          ownerInput: injected,
          codec: recorder.codec,
        }).resolveCurrentRequest(),
      ).toEqual({ kind: 'rejected', code: 'provenance_invalid' });
      expect(recorder.issue).not.toHaveBeenCalled();
    }
  });

  it('snapshots owner input and never echoes raw subjects, key material or dependency details', async () => {
    const mutable = {
      ...ownerInput(),
    } as unknown as FormalRequestProvenanceOwnerInputV1;
    const owner = resolver({ ownerInput: mutable });
    (mutable as unknown as { accountId: string }).accountId = 'account-mutated';
    const result = await owner.resolveCurrentRequest();
    expect(result.kind).toBe('verified');

    const serialized = JSON.stringify(result);
    for (const forbidden of [
      'account-001',
      'request-001',
      'proof-001',
      Buffer.from(KEY).toString('hex'),
      'secret dependency detail',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('contains no request, transport, environment, logging or fallback-key surface', async () => {
    const source = await readFile(
      resolve(
        process.cwd(),
        'src/modules/security/server/formal-request-provenance-owner.ts',
      ),
      'utf8',
    );
    for (const forbidden of [
      'process.env',
      'fetch(',
      'console.',
      'logger',
      'NextRequest',
      "from 'next/",
      'new Request(',
      'cookies(',
      'headers(',
      'getDemoAccessContext',
      'randomBytes',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
