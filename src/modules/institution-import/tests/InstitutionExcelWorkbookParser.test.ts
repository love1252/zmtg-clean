import { describe, expect, it } from 'vitest';

import { parseInstitutionExcelImportEntriesV1 } from '@/modules/institution-import/server/institution-excel-workbook-parser';

const encoder = new TextEncoder();

const headers = {
  客户基本信息: [
    '客户外部编号*', '姓名*', '手机号*', '性别', '出生日期', '身份证号',
    '外部患者ID/HIS患者ID', '客户来源', '业务获客来源', '负责人', '建档时间', '备注',
  ],
  预约记录: [
    '预约外部编号*', '客户外部编号*', '预约日期时间*', '预约项目*', '医生/顾问',
    '资源/房间/设备', '预约状态', '数据来源', 'HIS预约ID', '创建人', '备注',
  ],
  治疗记录: [
    '治疗外部编号*', '客户外部编号*', '治疗日期时间*', '治疗项目*', '医生',
    '科室/院区', '治疗状态', '数据来源', '原始记录ID', '备注',
  ],
  消费记录: [
    '消费外部编号*', '客户外部编号*', '消费日期时间*', '消费项目*', '消费金额*',
    '币种', '订单/流水号', '支付状态', '数据来源', '原始记录ID', '备注',
  ],
} as const;

function column(index: number) {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function xmlEscape(value: string) {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

function row(rowNumber: number, values: readonly string[]) {
  return `<row r="${rowNumber}">${values.map((value, index) => (
    `<c r="${column(index)}${rowNumber}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`
  )).join('')}</row>`;
}

function sheetXml(sheetHeaders: readonly string[], values?: readonly string[]) {
  return encoder.encode(
    `<?xml version="1.0"?><worksheet><sheetData>${row(3, sheetHeaders)}${values ? row(5, values) : ''}</sheetData></worksheet>`,
  );
}

function entries(input?: Readonly<{ appointmentCustomerRef?: string }>) {
  const names = Object.keys(headers) as Array<keyof typeof headers>;
  const result = new Map<string, Uint8Array>();
  result.set(
    'xl/workbook.xml',
    encoder.encode(`<workbook><sheets>${names.map((name, index) => `<sheet name="${name}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`),
  );
  result.set(
    'xl/_rels/workbook.xml.rels',
    encoder.encode(`<Relationships>${names.map((_name, index) => `<Relationship Id="rId${index + 1}" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}</Relationships>`),
  );
  result.set('xl/worksheets/sheet1.xml', sheetXml(headers.客户基本信息, [
    'C-001', '测试客户', '19999990001', '女', '33681', '', 'HIS-001',
    'Excel', '线上咨询', 'admin', '46235.5', '测试备注',
  ]));
  result.set('xl/worksheets/sheet2.xml', sheetXml(headers.预约记录, [
    'A-001', input?.appointmentCustomerRef ?? 'C-001', '46261.5', '光子嫩肤', '李医生',
    '治疗室1', '已确认', 'Excel', 'HIS-A-001', 'admin', '预约备注',
  ]));
  result.set('xl/worksheets/sheet3.xml', sheetXml(headers.治疗记录, [
    'T-001', 'C-001', '46246.5', '光子嫩肤', '李医生', '上海主院区',
    '已完成', 'Excel', 'RAW-T-001', '治疗备注',
  ]));
  result.set('xl/worksheets/sheet4.xml', sheetXml(headers.消费记录, [
    'P-001', 'C-001', '46246.5', '光子嫩肤', '2980', 'CNY', 'ORDER-001',
    '已支付', 'Excel', 'RAW-P-001', '消费备注',
  ]));
  return result;
}

describe('机构客户 Excel 工作簿解析', () => {
  it('按固定 Sheet、表头和关联键解析四类数据', () => {
    const result = parseInstitutionExcelImportEntriesV1(entries());
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.workbook.customers).toHaveLength(1);
    expect(result.workbook.appointments[0]).toMatchObject({
      customerExternalReference: 'C-001',
      status: 'confirmed',
    });
    expect(result.workbook.treatments[0]).toMatchObject({ status: '已完成' });
    expect(result.workbook.consumptions[0]).toMatchObject({
      amountMinor: 298_000,
      eventType: 'payment_succeeded',
    });
    expect(result.workbook.customers[0]?.birthDate).toBe('1992-03-18');
  });

  it('支持标准 x: XML 命名空间前缀', () => {
    const workbookEntries = entries();
    for (const [path, content] of workbookEntries) {
      if (path.endsWith('.rels')) continue;
      const prefixed = new TextDecoder().decode(content).replace(
        /<(\/?)((?:workbook|sheets|sheet|worksheet|sheetData|row|c|is|t|v))\b/gu,
        '<$1x:$2',
      );
      workbookEntries.set(path, encoder.encode(prefixed));
    }
    const result = parseInstitutionExcelImportEntriesV1(workbookEntries);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.workbook.customers).toHaveLength(1);
    expect(result.workbook.appointments).toHaveLength(1);
  });

  it('跨 Sheet 客户引用不存在时拒绝整个工作簿且不回显单元格值', () => {
    const missingReference = 'PRIVATE-MISSING-CUSTOMER';
    const result = parseInstitutionExcelImportEntriesV1(entries({
      appointmentCustomerRef: missingReference,
    }));
    expect(result.kind).toBe('invalid');
    expect(JSON.stringify(result)).toContain('customer_reference_not_found');
    expect(JSON.stringify(result)).not.toContain(missingReference);
    expect(JSON.stringify(result)).not.toContain('19999990001');
  });

  it('表头漂移时 fail closed', () => {
    const workbookEntries = entries();
    workbookEntries.set(
      'xl/worksheets/sheet1.xml',
      sheetXml(['错误客户字段'], ['C-001']),
    );
    const result = parseInstitutionExcelImportEntriesV1(workbookEntries);
    expect(result.kind).toBe('invalid');
    expect(result).toMatchObject({ code: 'invalid_template' });
  });
});
