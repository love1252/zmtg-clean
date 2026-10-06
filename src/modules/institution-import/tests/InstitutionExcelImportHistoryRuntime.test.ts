import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  decrypt: vi.fn(),
  findCompletedBatch: vi.fn(),
  getDatabase: vi.fn(),
  listBatchRows: vi.fn(),
  listRecentCompleted: vi.fn(),
}));

vi.mock('@/server/orchestration/institution-customer-controlled-write-runtime', () => ({
  authorizeInstitutionCustomerControlledWriteV1: mocks.authorize,
}));

vi.mock('@/server/db/client', () => ({
  getDatabase: mocks.getDatabase,
}));

vi.mock('@/modules/institution-import/server/institution-excel-import-repository', () => ({
  createInstitutionExcelImportRepositoryV1: () => ({
    findCompletedBatch: mocks.findCompletedBatch,
    listBatchRows: mocks.listBatchRows,
    listRecentCompleted: mocks.listRecentCompleted,
  }),
}));

vi.mock('@/modules/security/server/secretEncryption', () => ({
  decryptSecret: mocks.decrypt,
  encryptSecret: vi.fn(),
}));

import {
  getCurrentInstitutionExcelImportDetailV1,
  listCurrentInstitutionExcelImportHistoryV1,
} from '@/server/orchestration/institution-excel-import-runtime';

const batchId = 'imp-b-1234567890abcdef1234567890abcdef1234567890abcdef';
const completedAt = new Date('2026-08-30T10:37:00.000Z');
const scope = Object.freeze({
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/zmtg');
  mocks.getDatabase.mockReturnValue({});
  mocks.authorize.mockResolvedValue({
    kind: 'allowed',
    actor: {
      accountId: 'account-admin',
      role: 'tenant_admin',
      ...scope,
    },
  });
  mocks.findCompletedBatch.mockResolvedValue({
    id: batchId,
    completedAt,
    customerCount: 2,
    appointmentCount: 1,
    treatmentCount: 1,
    consumptionCount: 1,
  });
  mocks.listBatchRows.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe('机构客户 Excel 导入历史 Runtime', () => {
  it('历史记录返回可下钻批次 ID，并保持租户与机构范围', async () => {
    mocks.listRecentCompleted.mockResolvedValue([{
      id: batchId,
      completedAt,
      customerCount: 2,
      appointmentCount: 1,
      treatmentCount: 1,
      consumptionCount: 1,
    }]);

    await expect(listCurrentInstitutionExcelImportHistoryV1()).resolves.toEqual({
      kind: 'ready',
      records: [{
        batchId,
        completedAt: completedAt.toISOString(),
        summary: { customers: 2, appointments: 1, treatments: 1, consumptions: 1, totalRows: 5 },
      }],
    });
    expect(mocks.listRecentCompleted).toHaveBeenCalledWith({ ...scope, limit: 20 });
  });

  it('客户明细仅返回低敏投影，手机号脱敏且不回显身份证、外部患者 ID 或备注', async () => {
    mocks.findCompletedBatch.mockResolvedValue({
      id: batchId, completedAt, customerCount: 1, appointmentCount: 1, treatmentCount: 1, consumptionCount: 1,
    });
    mocks.decrypt.mockReturnValue(JSON.stringify({
      rowNumber: 5,
      externalReference: 'customer-0001',
      displayName: '测试客户',
      phone: '13812345678',
      gender: '女',
      birthDate: '1992-03-04',
      nationalId: '110101199203040000',
      externalPatientId: 'HIS-0001',
      source: 'Excel',
      acquisitionSource: '线上咨询',
      owner: '顾问甲',
      createdAt: '2026-08-20T09:30:00.000Z',
      notes: '不可回显的备注',
    }));
    mocks.listBatchRows.mockResolvedValue([{
      id: 'row-1',
      ...scope,
      batchId,
      sheetKind: 'customer',
      rowNumber: 5,
      externalReferenceDigest: 'a'.repeat(64),
      canonicalRecordId: 'imp-c-1234567890abcdef1234567890abcdef1234567890abcdef',
      protectedPayload: { algorithm: 'mock' },
    }]);

    const result = await getCurrentInstitutionExcelImportDetailV1({
      batchId,
      sheet: 'customer',
      page: 1,
      pageSize: 20,
    });
    expect(result).toMatchObject({
      kind: 'ready',
      batchId,
      sheet: 'customer',
      records: [{
        rowNumber: 5,
        canonicalReference: '***cdef',
        displayName: '测试客户',
        maskedPhone: '138****5678',
        gender: '女',
        source: 'Excel',
        acquisitionSource: '线上咨询',
        owner: '顾问甲',
      }],
      pageInfo: { page: 1, pageSize: 20, total: 1, pageCount: 1, hasPrevious: false, hasNext: false },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('13812345678');
    expect(serialized).not.toContain('110101199203040000');
    expect(serialized).not.toContain('HIS-0001');
    expect(serialized).not.toContain('不可回显的备注');
    expect(mocks.findCompletedBatch).toHaveBeenCalledWith({ ...scope, batchId });
    expect(mocks.listBatchRows).toHaveBeenCalledWith({
      ...scope,
      batchId,
      sheetKind: 'customer',
      limit: 20,
      offset: 0,
    });
  });

  it('其他机构不可见的批次返回未找到，且不读取行证据', async () => {
    mocks.findCompletedBatch.mockResolvedValue(null);

    await expect(getCurrentInstitutionExcelImportDetailV1({
      batchId,
      sheet: 'appointment',
      page: 1,
      pageSize: 20,
    })).resolves.toEqual({
      kind: 'not_found',
      code: 'customer_import_batch_not_found',
    });
    expect(mocks.listBatchRows).not.toHaveBeenCalled();
  });
});

const input = { batchId, sheet: 'customer' as const, page: 1, pageSize: 20 };
const batch = (changes = {}) => ({
  id: batchId, completedAt, customerCount: 1, appointmentCount: 1, treatmentCount: 1, consumptionCount: 1,
  ...changes,
});
const importRow = (sheetKind = 'customer', rowNumber = 5, changes = {}) => ({
  id: `row-${rowNumber}`, ...scope, batchId, sheetKind, rowNumber,
  externalReferenceDigest: 'a'.repeat(64), canonicalRecordId: 'canonical-cdef',
  protectedPayload: { algorithm: 'mock' }, ...changes,
});
const evidence = (rowNumber = 5, changes = {}) => ({
  rowNumber, displayName: '<测试客户>', phone: '13812345678', gender: '女', source: 'Excel',
  acquisitionSource: '咨询', owner: '顾问甲', createdAt: '2026-08-20T09:30:00Z',
  customerExternalReference: 'customer-0001', project: '测试项目', scheduledAt: '2026-08-20T09:30:00Z',
  treatmentAt: '2026-08-20T09:30:00Z', eventAt: '2026-08-20T09:30:00Z',
  consultant: '顾问甲', doctor: '医生乙', resource: '资源甲', department: '科室甲', status: 'confirmed',
  amountMinor: 12345, currency: 'CNY', eventType: 'payment_succeeded',
  nationalId: 'private-national-id', externalPatientId: 'private-patient-id',
  orderReference: 'private-order', hisAppointmentId: 'private-his',
  sourceRecordId: 'private-source-record', notes: 'private-notes', ...changes,
});
const unavailable = { kind: 'unavailable', code: 'customer_import_detail_unavailable' };

describe('导入明细范围、分页与异常边界', () => {
  beforeEach(() => {
    mocks.findCompletedBatch.mockResolvedValue(batch());
    mocks.listBatchRows.mockResolvedValue([importRow()]);
    mocks.decrypt.mockReturnValue(JSON.stringify(evidence()));
  });

  it.each(['tenant_admin', 'tenant_operator'])('%s 沿用现有受控授权要求', async role => {
    mocks.authorize.mockResolvedValue({ kind: 'allowed', actor: { ...scope, role, accountId: 'admin' } });
    expect((await getCurrentInstitutionExcelImportDetailV1(input)).kind).toBe('ready');
    expect(mocks.authorize).toHaveBeenCalledWith(true);
  });

  it.each([{ kind: 'forbidden' }, { kind: 'allowed', actor: { ...scope, role: 'consultant' } }])(
    '权限结果%o不能读取批次或解密', async authorization => {
      mocks.authorize.mockResolvedValue(authorization);
      expect(await getCurrentInstitutionExcelImportDetailV1(input)).toEqual({ kind: 'forbidden', code: 'customer_import_forbidden' });
      expect(mocks.getDatabase).not.toHaveBeenCalled();
      expect(mocks.decrypt).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['production', 'postgresql://localhost:5432/test'],
    ['development', 'postgresql://remote.example:5432/test'],
    ['development', 'not-a-database-url'],
  ])('环境%s和数据库地址仅用合成配置检查本地限制', async (environment, url) => {
    vi.stubEnv('NODE_ENV', environment); vi.stubEnv('DATABASE_URL', url);
    expect(await getCurrentInstitutionExcelImportDetailV1(input)).toEqual({ kind: 'unavailable', code: 'customer_import_local_only' });
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.getDatabase).not.toHaveBeenCalled();
  });

  it.each([
    { batchId: 'wrong' }, { sheet: 'wrong' }, { page: 0 }, { page: -1 },
    { page: 501 }, { page: 1.5 }, { page: Number.MAX_SAFE_INTEGER }, { pageSize: 25 },
  ])('非法输入%o在授权或查询前拒绝', async changes => {
    expect(await getCurrentInstitutionExcelImportDetailV1({ ...input, ...changes } as typeof input))
      .toEqual({ kind: 'invalid', code: 'invalid_customer_import_detail_query' });
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.findCompletedBatch).not.toHaveBeenCalled();
  });

  it.each(['customer', 'appointment', 'treatment', 'consumption'] as const)('%s只返回白名单字段', async sheet => {
    mocks.listBatchRows.mockResolvedValue([importRow(sheet)]);
    const result = await getCurrentInstitutionExcelImportDetailV1({ ...input, sheet });
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') throw new Error('expected_ready');
    expect(result.records[0]).toMatchObject({ rowNumber: 5, canonicalReference: '***cdef' });
    if (sheet === 'customer') expect(result.records[0]).toMatchObject({ displayName: '<测试客户>', maskedPhone: '138****5678' });
    if (sheet === 'appointment') expect(result.records[0]).toMatchObject({ practitioner: '顾问甲', resource: '资源甲' });
    if (sheet === 'treatment') expect(result.records[0]).toMatchObject({ practitioner: '医生乙', department: '科室甲' });
    if (sheet === 'consumption') expect(result.records[0]).toMatchObject({ amountMinor: 12345, currency: 'CNY', eventType: 'payment_succeeded' });
    const text = JSON.stringify(result);
    for (const secret of ['13812345678', 'private-', 'protectedPayload', 'externalReferenceDigest', 'tenantId', 'institutionId', 'algorithm']) expect(text).not.toContain(secret);
    expect(mocks.listBatchRows).toHaveBeenCalledWith({ ...scope, batchId, sheetKind: sheet, limit: 20, offset: 0 });
  });

  it('超过100条仍可读取第六页并保留完整总数', async () => {
    mocks.findCompletedBatch.mockResolvedValue(batch({ customerCount: 155 }));
    mocks.listBatchRows.mockResolvedValue(Array.from({ length: 20 }, (_, i) => importRow('customer', i + 102)));
    mocks.decrypt.mockImplementationOnce(() => JSON.stringify(evidence(102)));
    for (let i = 103; i <= 121; i++) mocks.decrypt.mockImplementationOnce(() => JSON.stringify(evidence(i)));
    const result = await getCurrentInstitutionExcelImportDetailV1({ ...input, page: 6 });
    expect(result).toMatchObject({ kind: 'ready', pageInfo: { page: 6, pageCount: 8, total: 155, hasPrevious: true, hasNext: true } });
    expect(mocks.listBatchRows).toHaveBeenCalledWith({ ...scope, batchId, sheetKind: 'customer', limit: 20, offset: 100 });
  });

  it('空Sheet与超末页保留真实总数，不解密任何行', async () => {
    mocks.findCompletedBatch.mockResolvedValue(batch({ appointmentCount: 0 }));
    mocks.listBatchRows.mockResolvedValue([]);
    expect(await getCurrentInstitutionExcelImportDetailV1({ ...input, sheet: 'appointment' }))
      .toMatchObject({ kind: 'ready', records: [], pageInfo: { total: 0, pageCount: 0, hasNext: false } });
    expect(await getCurrentInstitutionExcelImportDetailV1({ ...input, page: 2 }))
      .toMatchObject({ kind: 'ready', records: [], pageInfo: { total: 1, pageCount: 1, hasPrevious: true, hasNext: false } });
    expect(mocks.decrypt).not.toHaveBeenCalled();
  });

  it.each([{ customerCount: -1 }, { customerCount: 0 }, { treatmentCount: 0.5 }, { customerCount: 5001 }, { id: 'foreign-batch' }, { completedAt: new Date('invalid') }])(
    '损坏批次%o失败关闭，不伪造统计', async changes => {
      mocks.findCompletedBatch.mockResolvedValue(batch(changes));
      expect(await getCurrentInstitutionExcelImportDetailV1(input)).toEqual(unavailable);
      expect(mocks.listBatchRows).not.toHaveBeenCalled();
    },
  );

  it.each([{ tenantId: 'foreign' }, { institutionId: 'foreign' }, { batchId: 'foreign' }, { sheetKind: 'treatment' }, { rowNumber: 1 }, { rowNumber: 2 }, { rowNumber: 4 }])(
    '越界或损坏导入行%o在解密前拒绝', async changes => {
      mocks.listBatchRows.mockResolvedValue([importRow('customer', 5, changes)]);
      expect(await getCurrentInstitutionExcelImportDetailV1(input)).toEqual(unavailable);
      expect(mocks.decrypt).not.toHaveBeenCalled();
    },
  );

  it('数量与排序矛盾时失败关闭', async () => {
    mocks.listBatchRows.mockResolvedValue([]);
    expect(await getCurrentInstitutionExcelImportDetailV1(input)).toEqual(unavailable);
    mocks.findCompletedBatch.mockResolvedValue(batch({ customerCount: 2 }));
    for (const rows of [[importRow(), importRow()], [importRow('customer', 6), importRow('customer', 5)]]) {
      mocks.listBatchRows.mockResolvedValue(rows);
      expect(await getCurrentInstitutionExcelImportDetailV1(input)).toEqual(unavailable);
    }
    expect(mocks.decrypt).not.toHaveBeenCalled();
  });

  it.each([0, -1, 0.5, '12345', null])('损坏金额%o不显示为零', async amountMinor => {
    mocks.listBatchRows.mockResolvedValue([importRow('consumption')]);
    mocks.decrypt.mockReturnValue(JSON.stringify(evidence(5, { amountMinor })));
    expect(await getCurrentInstitutionExcelImportDetailV1({ ...input, sheet: 'consumption' })).toEqual(unavailable);
  });

  it.each(['invalid-json', '[]', 'null', '{"rowNumber":6}'])('损坏证据%s不回显内部信息', async payload => {
    mocks.decrypt.mockReturnValue(payload);
    expect(await getCurrentInstitutionExcelImportDetailV1(input)).toEqual(unavailable);
  });

  it('解密或仓库异常仅返回低敏不可用结果', async () => {
    mocks.decrypt.mockImplementation(() => { throw new Error('private-decryption-detail'); });
    expect(await getCurrentInstitutionExcelImportDetailV1(input)).toEqual(unavailable);
    mocks.findCompletedBatch.mockRejectedValue(new Error('private-database-detail'));
    expect(await getCurrentInstitutionExcelImportDetailV1(input)).toEqual(unavailable);
  });

  it('合法的长姓名、负责人、项目和科室沿用模板接受长度，不静默截短', async () => {
    const long = { displayName: '名'.repeat(120), gender: '性'.repeat(20), owner: '人'.repeat(96),
      project: '项'.repeat(160), consultant: '顾'.repeat(96), resource: '资'.repeat(160),
      doctor: '医'.repeat(96), department: '科'.repeat(160) };
    mocks.decrypt.mockReturnValue(JSON.stringify(evidence(5, long)));
    for (const sheet of ['customer', 'appointment', 'treatment'] as const) {
      mocks.listBatchRows.mockResolvedValue([importRow(sheet)]);
      const result = await getCurrentInstitutionExcelImportDetailV1({ ...input, sheet });
      expect(result.kind).toBe('ready');
      if (result.kind !== 'ready') throw new Error('expected_ready');
      if (sheet === 'customer') expect(result.records[0]).toMatchObject({ displayName: long.displayName, gender: long.gender, owner: long.owner });
      if (sheet === 'appointment') expect(result.records[0]).toMatchObject({ project: long.project, practitioner: long.consultant, resource: long.resource });
      if (sheet === 'treatment') expect(result.records[0]).toMatchObject({ project: long.project, practitioner: long.doctor, department: long.department });
    }
  });
});
