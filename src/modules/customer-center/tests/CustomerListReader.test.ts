import { describe, expect, it, vi } from 'vitest';

import {
  createCustomerListReaderV1,
  CUSTOMER_LIST_MAX_PAGE_V1,
  CUSTOMER_LIST_PAGE_SIZE_V1,
} from '@/modules/customer-center/application/customer-list-reader';
import type { CustomerListSourceV1 } from '@/modules/customer-center/ports/customer-list-source';

const baseRow = Object.freeze({
  customerId: 'customer-001',
  displayName: '客户甲',
  lifecycle: 'consulting' as const,
  priority: 'high' as const,
  updatedAt: '2026-08-15T08:00:00.000Z',
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
});

function createReader(
  rows: readonly unknown[] = [baseRow],
  total = Math.min(rows.length, 20),
) {
  const list = vi.fn(async () => rows);
  const count = vi.fn(async () => total);
  const source = Object.freeze({ list, count }) as unknown as CustomerListSourceV1;
  return { reader: createCustomerListReaderV1({ source }), list, count };
}

function read(
  reader: ReturnType<typeof createCustomerListReaderV1>,
  query = '',
) {
  return reader.read({
    tenantId: 'tenant-001',
    institutionId: 'institution-001',
    searchParams: new URLSearchParams(query),
  });
}

describe('Customers CUS-01 formal list Reader', () => {
  it('固定 6-field 低敏 DTO，并把 attribution pair 只留在 source query', async () => {
    const { reader, list } = createReader();

    await expect(read(reader)).resolves.toEqual({
      kind: 'ready',
      records: [
        {
          contractVersion: 'v1',
          customerId: 'customer-001',
          displayName: '客户甲',
          lifecycle: 'consulting',
          priority: 'high',
          updatedAt: '2026-08-15T08:00:00.000Z',
        },
      ],
      pageInfo: {
        page: 1,
        pageSize: 20,
        hasMore: false,
        total: 1,
        pageCount: 1,
      },
    });
    expect(list).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      lifecycle: null,
      priority: null,
      keyword: null,
      gender: null,
      ageBand: null,
      createdFrom: null,
      createdTo: null,
      limit: 21,
      offset: 0,
    });
    expect(JSON.stringify((await read(reader)))).not.toMatch(
      /tenantId|institutionId|phone|email|medical|notes|ownerUserId|external/i,
    );
  });

  it('page 100 使用 max offset 与 limit+1，精确产生 hasMore', async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      ...baseRow,
      customerId: `customer-${String(index).padStart(3, '0')}`,
    }));
    const { reader, list } = createReader(rows, 2_001);
    const result = await read(reader, 'page=100');

    expect(result).toMatchObject({
      kind: 'ready',
      pageInfo: {
        page: CUSTOMER_LIST_MAX_PAGE_V1,
        pageCount: CUSTOMER_LIST_MAX_PAGE_V1,
        hasMore: true,
      },
    });
    if (result.kind !== 'ready') throw new Error('expected ready');
    expect(result.records).toHaveLength(CUSTOMER_LIST_PAGE_SIZE_V1);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 21,
        offset: (CUSTOMER_LIST_MAX_PAGE_V1 - 1) * CUSTOMER_LIST_PAGE_SIZE_V1,
      }),
    );
  });

  it('只接受白名单 pageSize 并把合法 filters 与 count 下推', async () => {
    const { reader, list, count } = createReader([], 0);

    await expect(
      read(reader, 'page=2&pageSize=50&lifecycle=post_care&priority=observe&keyword=客户甲&gender=female&ageBand=30_39&createdFrom=2026-08-01&createdTo=2026-08-15'),
    ).resolves.toMatchObject({ kind: 'ready' });
    expect(list).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      lifecycle: 'post_care',
      priority: 'observe',
      keyword: '客户甲',
      gender: 'female',
      ageBand: '30_39',
      createdFrom: '2026-08-01',
      createdTo: '2026-08-15',
      limit: 51,
      offset: 50,
    });
    expect(count).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      lifecycle: 'post_care',
      priority: 'observe',
      keyword: '客户甲',
      gender: 'female',
      ageBand: '30_39',
      createdFrom: '2026-08-01',
      createdTo: '2026-08-15',
    });
  });

  it.each([
    'page=101',
    'page=0',
    'page=1.5',
    'page=01',
    'q=customer',
    'search=customer',
    'ownerId=owner-001',
    'page=1&page=1',
    'pageSize=25',
    'pageSize=10&pageSize=20',
    'lifecycle=legacy',
    'priority=watch',
    'keyword=13800138000',
    'gender=unknown',
    'ageBand=18_35',
    'createdFrom=2026-08-16&createdTo=2026-08-15',
  ])('非法或未准入 query %s 返回统一 400 contract 且不读 source', async (query) => {
    const { reader, list } = createReader();

    await expect(read(reader, query)).resolves.toEqual({
      kind: 'invalid_query',
      code: 'invalid_customer_query',
    });
    expect(list).not.toHaveBeenCalled();
  });

  it.each([
    { ...baseRow, tenantId: 'tenant-other' },
    { ...baseRow, institutionId: 'institution-other' },
  ])('任一 source row pair 漂移都整页 fail-closed', async (row) => {
    const { reader } = createReader([baseRow, row]);
    await expect(read(reader)).resolves.toEqual({ kind: 'unavailable' });
  });

  it('拒绝 source extra/sensitive fields，不能先读取再投影', async () => {
    const { reader } = createReader([
      { ...baseRow, phone: 'SENSITIVE', notes: 'SENSITIVE' },
    ]);
    await expect(read(reader)).resolves.toEqual({ kind: 'unavailable' });
  });

  it('拒绝非法时间、空 displayName、overflow 与 source failure', async () => {
    for (const rows of [
      [{ ...baseRow, updatedAt: 'not-time' }],
      [{ ...baseRow, displayName: '' }],
      Array.from({ length: 22 }, (_, index) => ({
        ...baseRow,
        customerId: `customer-${index}`,
      })),
    ]) {
      await expect(read(createReader(rows).reader)).resolves.toEqual({
        kind: 'unavailable',
      });
    }

    const source = Object.freeze({
      list: vi.fn(async () => {
        throw new Error('database secret');
      }),
      count: vi.fn(async () => 1),
    });
    await expect(
      read(createCustomerListReaderV1({ source })),
    ).resolves.toEqual({ kind: 'unavailable' });
  });

  it('count 与 sentinel 不一致时整页 fail-closed', async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      ...baseRow,
      customerId: `customer-${index}`,
    }));
    await expect(read(createReader(rows, 20).reader)).resolves.toEqual({
      kind: 'unavailable',
    });
    await expect(read(createReader([baseRow], 0).reader)).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it('displayName 按 PostgreSQL 字符语义计算 varchar(120)，不按 UTF-16 code unit', async () => {
    const validEmojiName = '😀'.repeat(120);
    const validResult = await read(
      createReader([{ ...baseRow, displayName: validEmojiName }]).reader,
    );
    expect(validResult).toMatchObject({
      kind: 'ready',
      records: [{ displayName: validEmojiName }],
    });

    await expect(
      read(
        createReader([
          { ...baseRow, displayName: '😀'.repeat(121) },
        ]).reader,
      ),
    ).resolves.toEqual({ kind: 'unavailable' });
  });

  it('返回 records/pageInfo 及其成员均冻结', async () => {
    const result = await read(createReader().reader);
    if (result.kind !== 'ready') throw new Error('expected ready');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.records)).toBe(true);
    expect(Object.isFrozen(result.records[0])).toBe(true);
    expect(Object.isFrozen(result.pageInfo)).toBe(true);
  });
});
