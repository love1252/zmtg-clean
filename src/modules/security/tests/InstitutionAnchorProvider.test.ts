import { describe, expect, it, vi } from 'vitest';

import * as anchorProviderModule from '@/modules/security/server/institution-anchor-provider';
import {
  createActiveInstitutionAnchorProviderV1,
  createAuthoritativeInstitutionAnchorFactReaderV1,
  isActiveInstitutionAnchorProviderV1,
  type AuthoritativeInstitutionAnchorFactReaderV1,
  type InstitutionAnchorFactRepositoryV1,
} from '@/modules/security/server/institution-anchor-provider';
import type { CurrentInstitutionAnchorFactRowV1 } from '@/modules/security/server/institution-anchor-repository';
import {
  createInstitutionGuardReferenceCodecV1,
  isInstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceCodecV1,
} from '@/modules/security/server/institution-guard-reference';

const NOW = new Date('2026-07-22T05:00:00.000Z');
const requestedAnchor = Object.freeze({
  tenantId: 'tenant-zhengpu',
  institutionId: 'institution-zhengpu',
});
const currentAnchorRow: CurrentInstitutionAnchorFactRowV1 = {
  tenantId: 'tenant-zhengpu',
  institutionId: 'institution-zhengpu',
  status: 'active',
  revision: 7,
};
const REFERENCE_KEY = new Uint8Array(32).fill(0x5a);

function createReader(input: {
  rows?: readonly CurrentInstitutionAnchorFactRowV1[];
  error?: Error;
  now?: () => Date;
} = {}) {
  const findCurrentInstitutionAnchorFacts = input.error
    ? vi.fn(async () => {
        throw input.error;
      })
    : vi.fn(async () => input.rows ?? [currentAnchorRow]);
  const repository: InstitutionAnchorFactRepositoryV1 = {
    findCurrentInstitutionAnchorFacts,
  };

  return {
    findCurrentInstitutionAnchorFacts,
    reader: createAuthoritativeInstitutionAnchorFactReaderV1({
      repository,
      now: input.now ?? (() => NOW),
    }),
  };
}

describe('机构锚点权威事实读取器', () => {
  it('一次重验后只返回低敏、不可变且不授予权限的 active 锚点事实', async () => {
    const { reader, findCurrentInstitutionAnchorFacts } = createReader();

    const result = await reader.resolve(requestedAnchor);

    expect(findCurrentInstitutionAnchorFacts).toHaveBeenCalledTimes(1);
    expect(findCurrentInstitutionAnchorFacts).toHaveBeenCalledWith(requestedAnchor);
    expect(result).toEqual({
      kind: 'current_anchor_fact',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
      revision: 7,
      observedAt: '2026-07-22T05:00:00.000Z',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.keys(result)).not.toEqual(
      expect.arrayContaining([
        'anchorReference',
        'anchorRevision',
        'approvedBy',
        'provisioningReferenceDigest',
        'provisioningSource',
      ]),
    );
  });

  it.each([
    ['锚点不存在', []],
    ['锚点已暂停', [{ ...currentAnchorRow, status: 'suspended' }]],
  ] as const)('%s 时返回不枚举细节的 institution_anchor_denied', async (_label, rows) => {
    const { reader } = createReader({
      rows: rows as readonly CurrentInstitutionAnchorFactRowV1[],
    });

    await expect(reader.resolve(requestedAnchor)).resolves.toEqual({
      kind: 'denied',
      code: 'institution_anchor_denied',
    });
  });

  it.each([
    ['出现重复结果', [currentAnchorRow, { ...currentAnchorRow }]],
    ['tenant 与请求不一致', [{ ...currentAnchorRow, tenantId: 'tenant-other' }]],
    [
      'institution 与请求不一致',
      [{ ...currentAnchorRow, institutionId: 'institution-other' }],
    ],
    ['revision 为零', [{ ...currentAnchorRow, revision: 0 }]],
    ['revision 不是安全整数', [{ ...currentAnchorRow, revision: Number.MAX_VALUE }]],
    ['status 是未知值', [{ ...currentAnchorRow, status: 'unknown' }]],
    [
      '数据库结果夹带额外字段',
      [{ ...currentAnchorRow, provisioningReferenceDigest: 'must-not-flow' }],
    ],
  ] as const)('%s 时保持 institution_anchor_unavailable', async (_label, rows) => {
    const { reader } = createReader({
      rows: rows as unknown as readonly CurrentInstitutionAnchorFactRowV1[],
    });

    await expect(reader.resolve(requestedAnchor)).resolves.toEqual({
      kind: 'unavailable',
      code: 'institution_anchor_unavailable',
    });
  });

  it('输入非法或含额外声明时不访问 repository', async () => {
    const { reader, findCurrentInstitutionAnchorFacts } = createReader();

    for (const query of [
      { ...requestedAnchor, tenantId: '../other' },
      { ...requestedAnchor, status: 'active' },
      Object.assign(Object.create({ inherited: true }), requestedAnchor),
      new Proxy({ ...requestedAnchor }, {}),
    ]) {
      await expect(reader.resolve(query as never)).resolves.toEqual({
        kind: 'unavailable',
        code: 'institution_anchor_unavailable',
      });
    }
    expect(findCurrentInstitutionAnchorFacts).not.toHaveBeenCalled();
  });

  it('拒绝 accessor、symbol、隐藏字段和 hostile Proxy，且不触发 getter', async () => {
    let getterReads = 0;
    const accessor = { ...requestedAnchor };
    Object.defineProperty(accessor, 'tenantId', {
      enumerable: true,
      get() {
        getterReads += 1;
        return 'tenant-zhengpu';
      },
    });
    const hidden = { ...requestedAnchor };
    Object.defineProperty(hidden, 'secret', { value: 'hidden', enumerable: false });
    const symbol = Object.assign({ ...requestedAnchor }, { [Symbol('scope')]: 'other' });
    const hostile = new Proxy(
      { ...requestedAnchor },
      {
        ownKeys() {
          throw new Error('query trap');
        },
      },
    );
    const { reader, findCurrentInstitutionAnchorFacts } = createReader();

    for (const query of [accessor, hidden, symbol, hostile]) {
      await expect(reader.resolve(query as never)).resolves.toEqual({
        kind: 'unavailable',
        code: 'institution_anchor_unavailable',
      });
    }
    expect(getterReads).toBe(0);
    expect(findCurrentInstitutionAnchorFacts).not.toHaveBeenCalled();
  });

  it('拒绝恶意结果数组和结果行并保持失败关闭', async () => {
    const sparseRows: unknown[] = [];
    sparseRows.length = 1;
    const extraRows = [currentAnchorRow] as unknown[] & { secret?: string };
    extraRows.secret = 'hidden';
    const accessorRow = { ...currentAnchorRow };
    Object.defineProperty(accessorRow, 'revision', {
      enumerable: true,
      get: () => 7,
    });

    for (const rowsValue of [
      new Proxy([currentAnchorRow], {}),
      sparseRows,
      extraRows,
      [new Proxy({ ...currentAnchorRow }, {})],
      [accessorRow],
      [Object.assign(Object.create(null), currentAnchorRow)],
    ]) {
      const repository: InstitutionAnchorFactRepositoryV1 = {
        async findCurrentInstitutionAnchorFacts() {
          return rowsValue as CurrentInstitutionAnchorFactRowV1[];
        },
      };
      const reader = createAuthoritativeInstitutionAnchorFactReaderV1({
        repository,
        now: () => NOW,
      });

      await expect(reader.resolve(requestedAnchor)).resolves.toEqual({
        kind: 'unavailable',
        code: 'institution_anchor_unavailable',
      });
    }
  });

  it('repository 或可信时钟不可用时返回 unavailable', async () => {
    const databaseFailure = createReader({ error: new Error('database unavailable') });
    const clockFailure = createReader({
      now: () => {
        throw new Error('clock unavailable');
      },
    });
    const invalidClock = createReader({ now: () => new Date(Number.NaN) });

    await expect(databaseFailure.reader.resolve(requestedAnchor)).resolves.toEqual({
      kind: 'unavailable',
      code: 'institution_anchor_unavailable',
    });
    await expect(clockFailure.reader.resolve(requestedAnchor)).resolves.toEqual({
      kind: 'unavailable',
      code: 'institution_anchor_unavailable',
    });
    await expect(invalidClock.reader.resolve(requestedAnchor)).resolves.toEqual({
      kind: 'unavailable',
      code: 'institution_anchor_unavailable',
    });
  });

  it('先完成 repository 重验，再以之后取得的服务端时间形成 observedAt', async () => {
    let clock = new Date('2026-07-22T05:00:00.000Z');
    const repository: InstitutionAnchorFactRepositoryV1 = {
      async findCurrentInstitutionAnchorFacts() {
        clock = new Date('2026-07-22T05:00:01.000Z');
        return [currentAnchorRow];
      },
    };
    const reader = createAuthoritativeInstitutionAnchorFactReaderV1({
      repository,
      now: () => clock,
    });

    await expect(reader.resolve(requestedAnchor)).resolves.toMatchObject({
      observedAt: '2026-07-22T05:00:01.000Z',
    });
  });
});

function currentFact(input: {
  revision?: number;
  observedAt?: string;
  tenantId?: string;
  institutionId?: string;
} = {}) {
  return Object.freeze({
    kind: 'current_anchor_fact' as const,
    tenantId: input.tenantId ?? 'tenant-zhengpu',
    institutionId: input.institutionId ?? 'institution-zhengpu',
    revision: input.revision ?? 7,
    observedAt: input.observedAt ?? '2026-07-22T05:00:00.000Z',
  });
}

function referenceCodec() {
  return createInstitutionGuardReferenceCodecV1({
    keyRing: {
      currentIssueKey: { keyVersion: 1, keyMaterial: REFERENCE_KEY },
      verifyOnlyKeys: [],
    },
    now: () => NOW,
  });
}

function activeProvider(input: {
  resolutions?: readonly unknown[];
  factReader?: AuthoritativeInstitutionAnchorFactReaderV1;
  codec?: InstitutionGuardReferenceCodecV1;
  nowValues?: readonly Date[];
  now?: () => Date;
} = {}) {
  const resolutions = [...(input.resolutions ?? [currentFact()])];
  const resolveFact = vi.fn(async () =>
    (resolutions.shift() ?? currentFact()) as never,
  );
  const factReader =
    input.factReader ??
    ({ resolve: resolveFact } as AuthoritativeInstitutionAnchorFactReaderV1);
  const nowValues = [
    ...(input.nowValues ?? [
      new Date('2026-07-22T05:00:01.000Z'),
      new Date('2026-07-22T05:00:02.000Z'),
    ]),
  ];
  const now = vi.fn(
    input.now ??
      (() =>
        nowValues.shift() ?? new Date('2026-07-22T05:00:02.000Z')),
  );

  return {
    now,
    resolveFact,
    provider: createActiveInstitutionAnchorProviderV1({
      factReader,
      referenceCodec: input.codec ?? referenceCodec(),
      now,
    }),
  };
}

describe('机构锚点 owner-sealed provider', () => {
  it('只认可 factory 实际创建的冻结 handle，克隆、伪造和代理均不可提升真实性', () => {
    const { provider } = activeProvider();
    const plain = Object.freeze({ resolve: provider.resolve });
    const spread = { ...provider };
    const cast = Object.freeze({ resolve: provider.resolve }) as ReturnType<
      typeof createActiveInstitutionAnchorProviderV1
    >;
    const customPrototype = Object.create(provider) as object;
    const clone = Object.freeze({ ...provider });
    const proxiedProvider = new Proxy(provider, {});
    const revocable = Proxy.revocable(provider, {});
    revocable.revoke();

    expect(isActiveInstitutionAnchorProviderV1(provider)).toBe(true);
    expect(Object.isFrozen(provider)).toBe(true);
    for (const candidate of [
      plain,
      spread,
      cast,
      customPrototype,
      clone,
      proxiedProvider,
      revocable.proxy,
      null,
      undefined,
      'provider',
    ]) {
      expect(isActiveInstitutionAnchorProviderV1(candidate)).toBe(false);
    }
  });

  it('真实性检查不读取任意属性，也不触发 getter 或 Proxy trap', () => {
    let getterReads = 0;
    let trapReads = 0;
    const accessor = {};
    Object.defineProperty(accessor, 'resolve', {
      enumerable: true,
      get() {
        getterReads += 1;
        return vi.fn();
      },
    });
    const hostile = new Proxy(
      {},
      {
        get() {
          trapReads += 1;
          throw new Error('get trap');
        },
        getPrototypeOf() {
          trapReads += 1;
          throw new Error('prototype trap');
        },
        ownKeys() {
          trapReads += 1;
          throw new Error('keys trap');
        },
        getOwnPropertyDescriptor() {
          trapReads += 1;
          throw new Error('descriptor trap');
        },
      },
    );
    const revoked = Proxy.revocable({}, {
      get() {
        trapReads += 1;
        throw new Error('revoked get trap');
      },
    });
    revoked.revoke();

    expect(isActiveInstitutionAnchorProviderV1(accessor)).toBe(false);
    expect(isActiveInstitutionAnchorProviderV1(hostile)).toBe(false);
    expect(isActiveInstitutionAnchorProviderV1(revoked.proxy)).toBe(false);
    expect(getterReads).toBe(0);
    expect(trapReads).toBe(0);
  });

  it('无效依赖仍只产生真实 factory handle，但 resolve 保持 unavailable', async () => {
    const provider = createActiveInstitutionAnchorProviderV1({} as never);

    expect(isActiveInstitutionAnchorProviderV1(provider)).toBe(true);
    expect(Object.isFrozen(provider)).toBe(true);
    await expect(provider.resolve(requestedAnchor)).resolves.toEqual({
      kind: 'unavailable',
      code: 'institution_anchor_unavailable',
    });
  });

  it('仅接受 factory 创建的 codec，结构克隆与 hostile wrapper 在读取依赖前失败关闭', async () => {
    const genuine = referenceCodec();
    expect(isInstitutionGuardReferenceCodecV1(genuine)).toBe(true);

    let getterReads = 0;
    let proxyTraps = 0;
    const cases = [
      () => {
        const issue = vi.fn(genuine.issue.bind(genuine));
        const verify = vi.fn(genuine.verify.bind(genuine));
        return {
          candidate: Object.freeze({ issue, verify }),
          issue,
          verify,
        };
      },
      () => {
        const issue = vi.fn(genuine.issue.bind(genuine));
        const verify = vi.fn(genuine.verify.bind(genuine));
        return { candidate: { ...genuine, issue, verify }, issue, verify };
      },
      () => {
        const issue = vi.fn(genuine.issue.bind(genuine));
        const verify = vi.fn(genuine.verify.bind(genuine));
        return {
          candidate: Object.freeze({ issue, verify }) as unknown as InstitutionGuardReferenceCodecV1,
          issue,
          verify,
        };
      },
      () => {
        const issue = vi.fn(genuine.issue.bind(genuine));
        const verify = vi.fn(genuine.verify.bind(genuine));
        return {
          candidate: Object.assign(Object.create({ inherited: true }), {
            issue,
            verify,
          }),
          issue,
          verify,
        };
      },
      () => {
        const issue = vi.fn(genuine.issue.bind(genuine));
        const verify = vi.fn(genuine.verify.bind(genuine));
        const candidate = {};
        Object.defineProperties(candidate, {
          issue: {
            enumerable: true,
            get() {
              getterReads += 1;
              return issue;
            },
          },
          verify: {
            enumerable: true,
            get() {
              getterReads += 1;
              return verify;
            },
          },
        });
        return { candidate, issue, verify };
      },
      () => {
        const issue = vi.fn(genuine.issue.bind(genuine));
        const verify = vi.fn(genuine.verify.bind(genuine));
        const candidate = new Proxy(
          { issue, verify },
          {
            get() {
              proxyTraps += 1;
              throw new Error('codec get trap');
            },
            ownKeys() {
              proxyTraps += 1;
              throw new Error('codec ownKeys trap');
            },
          },
        );
        return { candidate, issue, verify };
      },
      () => {
        const issue = vi.fn(genuine.issue.bind(genuine));
        const verify = vi.fn(genuine.verify.bind(genuine));
        const revoked = Proxy.revocable({ issue, verify }, {});
        revoked.revoke();
        return { candidate: revoked.proxy, issue, verify };
      },
    ];

    for (const createCase of cases) {
      const { candidate, issue, verify } = createCase();
      const resolveFact = vi.fn(async () => currentFact());
      const now = vi.fn(() => new Date('2026-07-22T05:00:01.000Z'));
      const provider = createActiveInstitutionAnchorProviderV1({
        factReader: { resolve: resolveFact },
        referenceCodec: candidate as InstitutionGuardReferenceCodecV1,
        now,
      });

      expect(isActiveInstitutionAnchorProviderV1(provider)).toBe(true);
      await expect(provider.resolve(requestedAnchor)).resolves.toEqual({
        kind: 'unavailable',
        code: 'institution_anchor_unavailable',
      });
      expect(resolveFact).not.toHaveBeenCalled();
      expect(now).not.toHaveBeenCalled();
      expect(issue).not.toHaveBeenCalled();
      expect(verify).not.toHaveBeenCalled();
    }

    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('接受 genuine-but-unavailable codec 真实性并保持低敏 unavailable', async () => {
    const codec = createInstitutionGuardReferenceCodecV1({
      keyRing: {
        currentIssueKey: { keyVersion: 1, keyMaterial: null },
        verifyOnlyKeys: [],
      },
      now: () => NOW,
    });
    expect(isInstitutionGuardReferenceCodecV1(codec)).toBe(true);
    const { provider, resolveFact, now } = activeProvider({ codec });

    await expect(provider.resolve(requestedAnchor)).resolves.toEqual({
      kind: 'unavailable',
      code: 'institution_anchor_unavailable',
    });
    expect(resolveFact).toHaveBeenCalledTimes(1);
    expect(now).toHaveBeenCalledTimes(1);
  });

  it('模块不导出 handle 注册、集合、解析、rehydrate 或 promotion 能力', () => {
    expect(Object.keys(anchorProviderModule).sort()).toEqual([
      'createActiveInstitutionAnchorProviderV1',
      'createAuthoritativeInstitutionAnchorFactReaderV1',
      'isActiveInstitutionAnchorProviderV1',
    ]);
  });

  it('在同一权威事实上成功签发 anc/arv 后原子返回60秒 active evidence', async () => {
    const { provider, resolveFact, now } = activeProvider();

    const result = await provider.resolve(requestedAnchor);

    expect(resolveFact).toHaveBeenCalledTimes(1);
    expect(resolveFact).toHaveBeenCalledWith(requestedAnchor);
    expect(now).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      kind: 'active',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
      anchorReference: expect.stringMatching(/^anc_v1_k1_[A-Za-z0-9_-]{43}$/u),
      anchorRevision: expect.stringMatching(/^arv_v1_k1_[A-Za-z0-9_-]{43}$/u),
      observedAt: '2026-07-22T05:00:00.000Z',
      freshUntil: '2026-07-22T05:01:00.000Z',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('revision-7');
    expect(result).not.toHaveProperty('revision');
  });

  it('factory 对 accessor、symbol、额外字段、原型和 Proxy 依赖零读取且构造失败关闭 provider', async () => {
    let getterReads = 0;
    let queryTrapReads = 0;
    const resolveFact = vi.fn(async () => currentFact());
    const now = vi.fn(() => new Date('2026-07-22T05:00:01.000Z'));
    const validInput = {
      factReader: { resolve: resolveFact },
      referenceCodec: referenceCodec(),
      now,
    };
    const accessorInput = { ...validInput };
    Object.defineProperty(accessorInput, 'factReader', {
      enumerable: true,
      get() {
        getterReads += 1;
        return validInput.factReader;
      },
    });
    const accessorReader = {};
    Object.defineProperty(accessorReader, 'resolve', {
      enumerable: true,
      get() {
        getterReads += 1;
        return resolveFact;
      },
    });
    const hostileInput = new Proxy(validInput, {
      ownKeys() {
        throw new Error('factory input trap');
      },
    });
    const invalidInputs = [
      accessorInput,
      { ...validInput, [Symbol('dependency')]: 'hidden' },
      { ...validInput, extra: 'must-not-flow' },
      Object.assign(Object.create({ inherited: true }), validInput),
      hostileInput,
      { ...validInput, factReader: accessorReader },
      { ...validInput, referenceCodec: new Proxy(referenceCodec(), {}) },
      { ...validInput, now: new Proxy(now, {}) },
    ];

    for (const invalidInput of invalidInputs) {
      const provider = createActiveInstitutionAnchorProviderV1(
        invalidInput as never,
      );
      const hostileQuery = new Proxy(
        { ...requestedAnchor },
        {
          ownKeys() {
            queryTrapReads += 1;
            throw new Error('query trap');
          },
        },
      );

      expect(Object.isFrozen(provider)).toBe(true);
      await expect(provider.resolve(requestedAnchor)).resolves.toEqual({
        kind: 'unavailable',
        code: 'institution_anchor_unavailable',
      });
      await expect(provider.resolve(hostileQuery)).resolves.toEqual({
        kind: 'unavailable',
        code: 'institution_anchor_unavailable',
      });
    }
    expect(getterReads).toBe(0);
    expect(queryTrapReads).toBe(0);
    expect(resolveFact).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });

  it('每次 resolve 都重读事实且 anc 跨 revision 稳定、arv 随 revision 变化', async () => {
    const { provider, resolveFact } = activeProvider({
      resolutions: [currentFact({ revision: 7 }), currentFact({ revision: 8 })],
      nowValues: [
        new Date('2026-07-22T05:00:01.000Z'),
        new Date('2026-07-22T05:00:02.000Z'),
        new Date('2026-07-22T05:00:03.000Z'),
        new Date('2026-07-22T05:00:04.000Z'),
      ],
    });

    const first = await provider.resolve(requestedAnchor);
    const second = await provider.resolve(requestedAnchor);

    expect(resolveFact).toHaveBeenCalledTimes(2);
    expect(first.kind).toBe('active');
    expect(second.kind).toBe('active');
    if (first.kind === 'active' && second.kind === 'active') {
      expect(first.anchorReference).toBe(second.anchorReference);
      expect(first.anchorRevision).not.toBe(second.anchorRevision);
    }
  });

  it('只以机构作用域和 owner 私有非敏感 subject 签发两个引用', async () => {
    const codec = referenceCodec();
    const expectedAnchor = codec.issue({
      prefix: 'anc',
      ownerDomain: 'security.institution-anchor',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
      ownerSubject: 'institution-anchor' as never,
    });
    const expectedRevision = codec.issue({
      prefix: 'arv',
      ownerDomain: 'security.institution-anchor',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
      ownerSubject: 'revision-7' as never,
    });
    const { provider } = activeProvider({ codec });

    const result = await provider.resolve(requestedAnchor);
    expect(expectedAnchor.kind).toBe('issued');
    expect(expectedRevision.kind).toBe('issued');
    expect(result.kind).toBe('active');
    if (
      result.kind === 'active' &&
      expectedAnchor.kind === 'issued' &&
      expectedRevision.kind === 'issued'
    ) {
      expect(result.anchorReference).toBe(expectedAnchor.reference);
      expect(result.anchorRevision).toBe(expectedRevision.reference);
    }
  });

  it.each([
    [
      'raw denied',
      { kind: 'denied', code: 'institution_anchor_denied' },
      { kind: 'denied', code: 'institution_anchor_denied' },
    ],
    [
      'raw unavailable',
      { kind: 'unavailable', code: 'institution_anchor_unavailable' },
      { kind: 'unavailable', code: 'institution_anchor_unavailable' },
    ],
  ] as const)('%s 保持受控分类且不读取时钟', async (_label, resolution, expected) => {
    const { provider, now } = activeProvider({ resolutions: [resolution] });

    await expect(provider.resolve(requestedAnchor)).resolves.toEqual(expected);
    expect(now).not.toHaveBeenCalled();
  });

  it.each([
    ['scope 不一致', currentFact({ institutionId: 'institution-other' })],
    ['revision 非正整数', currentFact({ revision: 0 })],
    [
      'observedAt 非 canonical',
      currentFact({ observedAt: '2026-07-22T05:00:00Z' }),
    ],
    [
      '夹带 raw 字段',
      { ...currentFact(), rawRevision: 7 },
    ],
    [
      '未知 kind',
      { kind: 'active', tenantId: 'tenant-zhengpu' },
    ],
    [
      'hostile Proxy',
      new Proxy(currentFact(), {
        ownKeys() {
          throw new Error('raw fact trap');
        },
      }),
    ],
  ] as const)('%s 时返回 unavailable 且不签发', async (_label, resolution) => {
    const { provider } = activeProvider({ resolutions: [resolution] });

    await expect(provider.resolve(requestedAnchor)).resolves.toEqual({
      kind: 'unavailable',
      code: 'institution_anchor_unavailable',
    });
  });

  it('非法调用 scope 不访问权威 reader', async () => {
    const { provider, resolveFact } = activeProvider();

    for (const query of [
      { ...requestedAnchor, tenantId: '../other' },
      { ...requestedAnchor, revision: 7 },
      new Proxy({ ...requestedAnchor }, {}),
    ]) {
      await expect(provider.resolve(query as never)).resolves.toEqual({
        kind: 'unavailable',
        code: 'institution_anchor_unavailable',
      });
    }
    expect(resolveFact).not.toHaveBeenCalled();
  });

  it('genuine codec 无可用签发密钥时不发布部分 evidence', async () => {
    const codec = createInstitutionGuardReferenceCodecV1({
      keyRing: {
        currentIssueKey: { keyVersion: 1, keyMaterial: null },
        verifyOnlyKeys: [],
      },
      now: () => NOW,
    });
    const { provider } = activeProvider({ codec });

    const result = await provider.resolve(requestedAnchor);
    expect(result).toEqual({
      kind: 'unavailable',
      code: 'institution_anchor_unavailable',
    });
    expect(result).not.toHaveProperty('anchorReference');
    expect(result).not.toHaveProperty('anchorRevision');
  });

  it('拒绝可伪造 codec 的错误前缀、短标签、额外字段与 hostile 结果且不调用', async () => {
    const malformedResults = [
      { kind: 'issued', reference: `arv_v1_k1_${'A'.repeat(43)}` },
      { kind: 'issued', reference: `anc_v1_k1_${'A'.repeat(22)}` },
      {
        kind: 'issued',
        reference: `anc_v1_k1_${'A'.repeat(43)}`,
        rawRevision: 7,
      },
      new Proxy(
        { kind: 'issued', reference: `anc_v1_k1_${'A'.repeat(43)}` },
        {
          ownKeys() {
            throw new Error('codec result trap');
          },
        },
      ),
    ];

    for (const malformedResult of malformedResults) {
      const issue = vi.fn(() => malformedResult as never);
      const codec = {
        issue,
        verify: vi.fn(),
      } as unknown as InstitutionGuardReferenceCodecV1;
      const { provider, resolveFact, now } = activeProvider({ codec });

      await expect(provider.resolve(requestedAnchor)).resolves.toEqual({
        kind: 'unavailable',
        code: 'institution_anchor_unavailable',
      });
      expect(resolveFact).not.toHaveBeenCalled();
      expect(now).not.toHaveBeenCalled();
      expect(issue).not.toHaveBeenCalled();
    }
  });

  it.each([
    [
      'fact 在签发前已过期',
      [new Date('2026-07-22T05:01:00.000Z')],
    ],
    [
      'fact 时间来自未来',
      [new Date('2026-07-22T04:59:59.999Z')],
    ],
    [
      '签发完成时 freshness 已过期',
      [
        new Date('2026-07-22T05:00:59.999Z'),
        new Date('2026-07-22T05:01:00.000Z'),
      ],
    ],
    [
      '签发后时钟倒退',
      [
        new Date('2026-07-22T05:00:02.000Z'),
        new Date('2026-07-22T05:00:01.000Z'),
      ],
    ],
    ['时钟非法', [new Date(Number.NaN)]],
  ] as const)('%s 时保持 unavailable', async (_label, nowValues) => {
    const { provider } = activeProvider({ nowValues });

    await expect(provider.resolve(requestedAnchor)).resolves.toEqual({
      kind: 'unavailable',
      code: 'institution_anchor_unavailable',
    });
  });

  it('可信时钟抛错时保持 unavailable 且不签发', async () => {
    const { provider, resolveFact, now } = activeProvider({
      now: () => {
        throw new Error('trusted clock unavailable');
      },
    });

    await expect(provider.resolve(requestedAnchor)).resolves.toEqual({
      kind: 'unavailable',
      code: 'institution_anchor_unavailable',
    });
    expect(resolveFact).toHaveBeenCalledTimes(1);
    expect(now).toHaveBeenCalledTimes(1);
  });
});
