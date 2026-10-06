import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  detail: vi.fn(),
  execute: vi.fn(),
  history: vi.fn(),
  preview: vi.fn(),
}));

vi.mock('@/server/orchestration/institution-excel-import-runtime', () => ({
  executeCurrentInstitutionExcelImportV1: runtime.execute,
  getCurrentInstitutionExcelImportDetailV1: runtime.detail,
  INSTITUTION_EXCEL_IMPORT_DETAIL_PAGE_SIZES: [10, 20, 50, 100],
  listCurrentInstitutionExcelImportHistoryV1: runtime.history,
  previewCurrentInstitutionExcelImportV1: runtime.preview,
}));

import {
  GET as listCustomerImports,
  POST as previewCustomerImport,
  PUT as executeCustomerImport,
} from '@/app/api/institution/customers/import/route';

function request(
  method: 'POST' | 'PUT',
  input: Readonly<{ fileName?: string; bytes?: Uint8Array; extraField?: boolean }> = {},
  origin = 'http://localhost',
) {
  const boundary = 'institution-import-test-boundary';
  const bytes = input.bytes ?? new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
  const file = Object.freeze({
    name: input.fileName ?? 'institution-customers.xlsx',
    size: bytes.length,
    arrayBuffer: async () => bytes.slice().buffer,
  });
  const form = Object.freeze({
    keys: () => (input.extraField ? ['file', 'tenantId'] : ['file']).values(),
    get: (key: string) => key === 'file' ? file : null,
  });
  const result = new Request('http://localhost/api/institution/customers/import', {
    method,
    headers: {
      origin,
      'sec-fetch-site': 'same-origin',
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
  });
  Object.defineProperty(result, 'formData', {
    configurable: true,
    value: async () => form,
  });
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  runtime.preview.mockResolvedValue({
    kind: 'ready',
    mode: 'preview',
    summary: { customers: 2, appointments: 1, treatments: 1, consumptions: 1, totalRows: 5 },
  });
  runtime.execute.mockResolvedValue({
    kind: 'ready',
    mode: 'completed',
    batchId: 'batch-safe',
    summary: { customers: 2, appointments: 1, treatments: 1, consumptions: 1, totalRows: 5 },
  });
  runtime.history.mockResolvedValue({
    kind: 'ready',
    records: [{
      batchId: 'imp-b-1234567890abcdef1234567890abcdef1234567890abcdef',
      completedAt: '2026-08-26T14:00:00.000Z',
      summary: { customers: 2, appointments: 1, treatments: 1, consumptions: 1, totalRows: 5 },
    }],
  });
  runtime.detail.mockResolvedValue({
    kind: 'ready',
    batchId: 'imp-b-1234567890abcdef1234567890abcdef1234567890abcdef',
    completedAt: '2026-08-26T14:00:00.000Z',
    summary: { customers: 2, appointments: 1, treatments: 1, consumptions: 1, totalRows: 5 },
    sheet: 'customer',
    records: [{
      rowNumber: 5,
      canonicalReference: '***abcd',
      displayName: '测试客户',
      maskedPhone: '138****5678',
    }],
    pageInfo: { page: 1, pageSize: 20, total: 2, pageCount: 1, hasPrevious: false, hasNext: false },
  });
});

describe('机构客户 Excel 导入 API', () => {
  it('POST 只执行预检，PUT 执行事务导入', async () => {
    const previewResponse = await previewCustomerImport(request('POST'));
    expect(previewResponse.status).toBe(200);
    expect(previewResponse.headers.get('cache-control')).toBe('no-store');
    expect(runtime.preview).toHaveBeenCalledTimes(1);
    expect(runtime.execute).not.toHaveBeenCalled();

    const executeResponse = await executeCustomerImport(request('PUT'));
    expect(executeResponse.status).toBe(200);
    expect(runtime.execute).toHaveBeenCalledTimes(1);
  });

  it('GET 只返回当前授权机构的低敏真实导入批次', async () => {
    const response = await listCustomerImports(new Request(
      'http://localhost/api/institution/customers/import',
    ));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      kind: 'ready',
      records: [{
        batchId: 'imp-b-1234567890abcdef1234567890abcdef1234567890abcdef',
        completedAt: '2026-08-26T14:00:00.000Z',
        summary: { customers: 2, appointments: 1, treatments: 1, consumptions: 1, totalRows: 5 },
      }],
    });
    expect(runtime.history).toHaveBeenCalledTimes(1);
  });

  it('GET 通过批次 ID、Sheet 和分页参数返回低敏导入行明细', async () => {
    const batchId = 'imp-b-1234567890abcdef1234567890abcdef1234567890abcdef';
    const response = await listCustomerImports(new Request(
      `http://localhost/api/institution/customers/import?batchId=${batchId}&sheet=customer&page=1&pageSize=20`,
    ));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({
      kind: 'ready',
      batchId,
      sheet: 'customer',
      records: [{ displayName: '测试客户', maskedPhone: '138****5678' }],
    });
    expect(runtime.detail).toHaveBeenCalledWith({ batchId, sheet: 'customer', page: 1, pageSize: 20 });
    expect(runtime.history).not.toHaveBeenCalled();
  });

  it('GET 拒绝未知参数、无效 Sheet 和不支持的页容量', async () => {
    const invalid = await listCustomerImports(new Request(
      'http://localhost/api/institution/customers/import?batchId=unsafe&sheet=unknown&page=1&pageSize=25&tenantId=leak',
    ));
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({
      kind: 'invalid',
      code: 'invalid_customer_import_detail_query',
    });
    expect(runtime.detail).not.toHaveBeenCalled();
    expect(runtime.history).not.toHaveBeenCalled();
  });

  it.each([
    'batchId=bad&sheet=customer',
    'sheet=customer',
    `batchId=${'imp-b-' + 'a'.repeat(48)}`,
    `batchId=${'imp-b-' + 'a'.repeat(48)}&sheet=customer&page=0`,
    `batchId=${'imp-b-' + 'a'.repeat(48)}&sheet=customer&page=501`,
    `batchId=${'imp-b-' + 'a'.repeat(48)}&sheet=customer&page=1e0`,
    `batchId=${'imp-b-' + 'a'.repeat(48)}&sheet=customer&page=%201`,
    `batchId=${'imp-b-' + 'a'.repeat(48)}&sheet=customer&page=01`,
    `batchId=${'imp-b-' + 'a'.repeat(48)}&sheet=customer&page=1&page=2`,
    `batchId=${'imp-b-' + 'a'.repeat(48)}&sheet=customer&pageSize=`,
    `batchId=${'imp-b-' + 'a'.repeat(48)}&sheet=customer&institutionId=foreign`,
  ])('GET 严格拒绝非法明细查询 %s', async query => {
    const response = await listCustomerImports(new Request('http://localhost/api/institution/customers/import?' + query));
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(runtime.detail).not.toHaveBeenCalled();
    expect(runtime.history).not.toHaveBeenCalled();
  });

  it.each([['forbidden', 403], ['not_found', 404], ['unavailable', 503], ['invalid', 400]] as const)(
    'GET 将%s映射为%s并禁止缓存', async (kind, status) => {
      runtime.detail.mockResolvedValue({ kind, code: 'low_sensitive_code' });
      const response = await listCustomerImports(new Request(
        `http://localhost/api/institution/customers/import?batchId=${'imp-b-' + 'a'.repeat(48)}&sheet=customer`,
      ));
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(runtime.detail).toHaveBeenCalledWith({ batchId: 'imp-b-' + 'a'.repeat(48), sheet: 'customer', page: 1, pageSize: 20 });
    },
  );

  it('跨站请求在读取文件和调用 Runtime 前被拒绝', async () => {
    const response = await previewCustomerImport(request('POST', {}, 'https://attacker.example'));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      kind: 'forbidden',
      code: 'csrf_validation_failed',
    });
    expect(runtime.preview).not.toHaveBeenCalled();
  });

  it('拒绝非 xlsx、额外表单字段和超限声明', async () => {
    const invalidResponse = await previewCustomerImport(request('POST', {
      fileName: 'customers.csv',
      bytes: new TextEncoder().encode('not-xlsx'),
      extraField: true,
    }));
    expect(invalidResponse.status).toBe(400);
    expect(runtime.preview).not.toHaveBeenCalled();

    const oversized = new Request('http://localhost/api/institution/customers/import', {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        'sec-fetch-site': 'same-origin',
        'content-type': 'multipart/form-data; boundary=safe',
        'content-length': String(11 * 1024 * 1024),
      },
      body: '--safe--',
    });
    const oversizedResponse = await previewCustomerImport(oversized);
    expect(oversizedResponse.status).toBe(400);
    expect(runtime.preview).not.toHaveBeenCalled();
  });

  it('Runtime 错误不回显文件载荷或作用域输入', async () => {
    runtime.preview.mockResolvedValue({
      kind: 'invalid',
      code: 'validation_failed',
      issues: [{ sheet: '客户基本信息', row: 5, field: '手机号*', code: 'invalid_phone' }],
    });
    const response = await previewCustomerImport(request('POST'));
    expect(response.status).toBe(400);
    const serialized = JSON.stringify(await response.json());
    expect(serialized).toContain('invalid_phone');
    expect(serialized).not.toMatch(/tenantId|institutionId|DATABASE_URL|token|cookie/iu);
  });
});
