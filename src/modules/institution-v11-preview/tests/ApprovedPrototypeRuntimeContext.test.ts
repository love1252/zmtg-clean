import { beforeEach, describe, expect, it, vi } from 'vitest';

const capabilityMocks = vi.hoisted(() => ({
  resolveInstitutionCapabilityAuthorityStatusV1: vi.fn(),
}));
const databaseMocks = vi.hoisted(() => ({
  limit: vi.fn(),
}));

vi.mock('@/server/orchestration/institution-capability-authority', () =>
  capabilityMocks,
);
vi.mock('@/server/db/client', () => ({
  getDatabase: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: databaseMocks.limit }),
      }),
    }),
  }),
}));

import { resolveApprovedPrototypeRuntimeContextV1 } from '@/modules/institution-v11-preview/server/approved-prototype-runtime-context';

describe('ApprovedPrototypeRuntimeContext', () => {
  beforeEach(() => {
    capabilityMocks.resolveInstitutionCapabilityAuthorityStatusV1.mockReset();
    databaseMocks.limit.mockReset();
  });

  it('只从已消费的授权作用域返回活跃机构展示上下文', async () => {
    capabilityMocks.resolveInstitutionCapabilityAuthorityStatusV1.mockResolvedValue(
      Object.freeze({
        scope: Object.freeze({
          tenantId: 'growth-tenant-chengxing',
          institutionId: 'growth-inst-chengxing',
        }),
      }),
    );
    databaseMocks.limit.mockResolvedValue([
      { name: '澄星医疗美容', status: 'active' },
    ]);

    await expect(resolveApprovedPrototypeRuntimeContextV1()).resolves.toEqual({
      tenantId: 'growth-tenant-chengxing',
      institutionId: 'growth-inst-chengxing',
      institutionName: '澄星医疗美容',
    });
    expect(
      capabilityMocks.resolveInstitutionCapabilityAuthorityStatusV1,
    ).toHaveBeenCalledOnce();
  });

  it.each([
    { rows: [], label: '租户不存在' },
    {
      rows: [{ name: '澄星医疗美容', status: 'suspended' }],
      label: '租户未激活',
    },
    {
      rows: [
        { name: '澄星医疗美容', status: 'active' },
        { name: '重复租户', status: 'active' },
      ],
      label: '租户结果不唯一',
    },
  ])('$label 时 fail closed', async ({ rows }) => {
    capabilityMocks.resolveInstitutionCapabilityAuthorityStatusV1.mockResolvedValue(
      Object.freeze({
        scope: Object.freeze({
          tenantId: 'tenant-1',
          institutionId: 'institution-1',
        }),
      }),
    );
    databaseMocks.limit.mockResolvedValue(rows);

    await expect(resolveApprovedPrototypeRuntimeContextV1()).resolves.toBeNull();
  });
});
