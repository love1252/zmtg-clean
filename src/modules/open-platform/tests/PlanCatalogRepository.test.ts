import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createPlanCatalogRepository } from '@/modules/open-platform/server/plan-catalog-repository';
import type { TenantDatabase } from '@/server/db/client';
import { tenantPlans, tenantPlanVersions } from '@/server/db/schema';

const ascMock = vi.hoisted(() =>
  vi.fn((column: unknown) => ({
    column,
    direction: 'asc',
  })),
);
const descMock = vi.hoisted(() =>
  vi.fn((column: unknown) => ({
    column,
    direction: 'desc',
  })),
);
const eqMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'eq',
    value,
  })),
);

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    asc: ascMock,
    desc: descMock,
    eq: eqMock,
  };
});

function createPlanCatalogDatabase(rows: unknown[] = []) {
  const orderBy = vi.fn(async (..._orders: unknown[]) => rows);
  const leftJoinVersions = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ leftJoin: leftJoinVersions }));
  const select = vi.fn(() => ({ from }));

  return {
    database: { select } as unknown as TenantDatabase,
    from,
    leftJoinVersions,
    orderBy,
    select,
  };
}

const planRow = {
  id: 'plan-professional',
  name: 'Professional 专业版',
  code: 'professional',
  description: '适合增长期机构',
  status: 'active',
  createdAt: new Date('2026-06-20T00:00:00.000Z'),
  updatedAt: new Date('2026-06-20T00:00:00.000Z'),
};

const versionRow = {
  id: 'plan-version-professional-published',
  planId: 'plan-professional',
  versionCode: '2026-06-v1',
  status: 'published',
  displayName: 'Professional 专业版',
  displayPrice: '¥2999/月',
  priceNote: '参考价，线下确认',
  agentLimit: 3,
  seatLimit: 40,
  monthlyAiCallLimit: 300000,
  knowledgeStorageGb: 100,
  connectorEntitlementsJson: { connectors: ['企微', 'HIS'] },
  serviceEntitlementsJson: { services: ['实施支持'] },
  featureEntitlementsJson: { modules: ['客户运营'] },
  quotaEntitlementsJson: { aiCallsPerMonth: 300000 },
  changeSummary: '首次发布',
  createdBy: 'platform-user',
  updatedBy: 'platform-user',
  publishedBy: 'platform-user',
  publishedAt: new Date('2026-06-21T08:00:00.000Z'),
  retiredAt: null,
  createdAt: new Date('2026-06-20T08:00:00.000Z'),
  updatedAt: new Date('2026-06-21T08:00:00.000Z'),
};

beforeEach(() => {
  ascMock.mockClear();
  descMock.mockClear();
  eqMock.mockClear();
});

describe('平台套餐目录 repository', () => {
  it('导出套餐目录读写方法且不读取环境变量', () => {
    const repository = createPlanCatalogRepository({} as never);

    expect(repository).toEqual(
      expect.objectContaining({
        listPlanCatalogRecords: expect.any(Function),
        findPlan: expect.any(Function),
        findVersion: expect.any(Function),
        listVersionsByPlanId: expect.any(Function),
        createVersion: expect.any(Function),
        updateVersionDraft: expect.any(Function),
        updateVersionStatus: expect.any(Function),
        retirePublishedVersionsForPlan: expect.any(Function),
      }),
    );
  });

  it('查询套餐模板并左关联套餐版本，按套餐编码和版本更新时间稳定排序', async () => {
    const query = createPlanCatalogDatabase([
      {
        plan: planRow,
        version: versionRow,
      },
      {
        plan: planRow,
        version: { ...versionRow, id: 'plan-version-professional-draft', status: 'draft' },
      },
    ]);

    const result = await createPlanCatalogRepository(query.database).listPlanCatalogRecords();

    expect(query.from).toHaveBeenCalledWith(tenantPlans);
    expect(query.leftJoinVersions).toHaveBeenCalledWith(
      tenantPlanVersions,
      { column: tenantPlanVersions.planId, operator: 'eq', value: tenantPlans.id },
    );
    expect(query.orderBy).toHaveBeenCalledWith(
      { column: tenantPlans.code, direction: 'asc' },
      { column: tenantPlanVersions.updatedAt, direction: 'desc' },
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        planId: 'plan-professional',
        planCode: 'professional',
        versions: expect.arrayContaining([
          expect.objectContaining({ versionId: 'plan-version-professional-published' }),
          expect.objectContaining({ versionId: 'plan-version-professional-draft' }),
        ]),
      }),
    );
  });

  it('无版本的套餐仍返回空 versions，方便前端创建首个草稿', async () => {
    const query = createPlanCatalogDatabase([
      {
        plan: { ...planRow, id: 'plan-enterprise', code: 'enterprise' },
        version: null,
      },
    ]);

    const result = await createPlanCatalogRepository(query.database).listPlanCatalogRecords();

    expect(result).toEqual([
      expect.objectContaining({
        planId: 'plan-enterprise',
        planCode: 'enterprise',
        versions: [],
      }),
    ]);
  });
});
