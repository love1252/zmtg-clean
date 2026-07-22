import { describe, expect, it, vi } from 'vitest';

import {
  createAuthoritativeInstitutionAnchorFactReaderV1,
  type InstitutionAnchorFactRepositoryV1,
} from '@/modules/security/server/institution-anchor-provider';
import type { CurrentInstitutionAnchorFactRowV1 } from '@/modules/security/server/institution-anchor-repository';

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
