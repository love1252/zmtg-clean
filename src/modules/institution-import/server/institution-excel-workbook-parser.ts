import { inflateRawSync } from 'node:zlib';

import type { AppointmentCommandStatus } from '@/modules/care/application/appointment-command-service';
import type { AnalyticsConsumptionEventType } from '@/modules/institution-analytics/domain/analytics-consumption-facts';

export const INSTITUTION_EXCEL_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const INSTITUTION_EXCEL_IMPORT_MAX_ROWS = 5_000;
const ZIP_ENTRY_MAX_INFLATED_BYTES = 12 * 1024 * 1024;
const ZIP_TOTAL_MAX_INFLATED_BYTES = 32 * 1024 * 1024;
const ISSUE_LIMIT = 50;

export type InstitutionExcelImportIssueV1 = Readonly<{
  sheet: string;
  row: number | null;
  field: string | null;
  code: string;
}>;

export type InstitutionExcelCustomerRowV1 = Readonly<{
  rowNumber: number;
  externalReference: string;
  displayName: string;
  phone: string;
  gender: string;
  birthDate: string;
  nationalId: string;
  externalPatientId: string;
  source: string;
  acquisitionSource: string;
  owner: string;
  createdAt: string;
  notes: string;
}>;

export type InstitutionExcelAppointmentRowV1 = Readonly<{
  rowNumber: number;
  externalReference: string;
  customerExternalReference: string;
  scheduledAt: string;
  project: string;
  consultant: string;
  resource: string;
  status: AppointmentCommandStatus;
  source: string;
  hisAppointmentId: string;
  createdBy: string;
  notes: string;
}>;

export type InstitutionExcelTreatmentRowV1 = Readonly<{
  rowNumber: number;
  externalReference: string;
  customerExternalReference: string;
  treatmentAt: string;
  project: string;
  doctor: string;
  department: string;
  status: string;
  source: string;
  sourceRecordId: string;
  notes: string;
}>;

export type InstitutionExcelConsumptionRowV1 = Readonly<{
  rowNumber: number;
  externalReference: string;
  customerExternalReference: string;
  eventAt: string;
  project: string;
  amountMinor: number;
  currency: string;
  orderReference: string;
  eventType: AnalyticsConsumptionEventType;
  source: string;
  sourceRecordId: string;
  notes: string;
}>;

export type InstitutionExcelImportWorkbookV1 = Readonly<{
  customers: readonly InstitutionExcelCustomerRowV1[];
  appointments: readonly InstitutionExcelAppointmentRowV1[];
  treatments: readonly InstitutionExcelTreatmentRowV1[];
  consumptions: readonly InstitutionExcelConsumptionRowV1[];
}>;

export type InstitutionExcelImportParseResultV1 =
  | Readonly<{ kind: 'ready'; workbook: InstitutionExcelImportWorkbookV1 }>
  | Readonly<{ kind: 'invalid'; code: string; issues: readonly InstitutionExcelImportIssueV1[] }>;

type CellMap = ReadonlyMap<string, string>;
type ParsedSheet = Readonly<{ name: string; rows: ReadonlyMap<number, CellMap> }>;

const expectedHeaders = Object.freeze({
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
} as const);

function readUint16(content: Uint8Array, offset: number) {
  if (offset < 0 || offset + 2 > content.byteLength) throw new Error('invalid_zip');
  return new DataView(content.buffer, content.byteOffset + offset, 2).getUint16(0, true);
}

function readUint32(content: Uint8Array, offset: number) {
  if (offset < 0 || offset + 4 > content.byteLength) throw new Error('invalid_zip');
  return new DataView(content.buffer, content.byteOffset + offset, 4).getUint32(0, true);
}

function decodeUtf8(content: Uint8Array) {
  return new TextDecoder('utf-8', { fatal: true }).decode(content);
}

function decodeXmlText(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, '$1')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&amp;/gu, '&')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'");
}

function readZipEntries(content: Uint8Array) {
  let eocdOffset = -1;
  for (let offset = content.byteLength - 22; offset >= Math.max(0, content.byteLength - 65_557); offset -= 1) {
    if (readUint32(content, offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('invalid_zip');

  const entryCount = readUint16(content, eocdOffset + 10);
  if (entryCount < 1 || entryCount > 128) throw new Error('invalid_zip');
  let centralOffset = readUint32(content, eocdOffset + 16);
  let totalInflatedBytes = 0;
  const entries = new Map<string, Uint8Array>();

  for (let index = 0; index < entryCount; index += 1) {
    if (readUint32(content, centralOffset) !== 0x02014b50) throw new Error('invalid_zip');
    const method = readUint16(content, centralOffset + 10);
    const compressedSize = readUint32(content, centralOffset + 20);
    const uncompressedSize = readUint32(content, centralOffset + 24);
    const filenameLength = readUint16(content, centralOffset + 28);
    const extraLength = readUint16(content, centralOffset + 30);
    const commentLength = readUint16(content, centralOffset + 32);
    const localOffset = readUint32(content, centralOffset + 42);
    const filename = decodeUtf8(content.slice(centralOffset + 46, centralOffset + 46 + filenameLength));
    if (filename.startsWith('/') || filename.includes('..') || filename.includes('\\')) {
      throw new Error('invalid_zip_path');
    }
    if (readUint32(content, localOffset) !== 0x04034b50) throw new Error('invalid_zip');
    const localFilenameLength = readUint16(content, localOffset + 26);
    const localExtraLength = readUint16(content, localOffset + 28);
    const dataOffset = localOffset + 30 + localFilenameLength + localExtraLength;
    if (
      uncompressedSize > ZIP_ENTRY_MAX_INFLATED_BYTES ||
      totalInflatedBytes + uncompressedSize > ZIP_TOTAL_MAX_INFLATED_BYTES ||
      dataOffset + compressedSize > content.byteLength
    ) {
      throw new Error('zip_limit');
    }
    const compressed = content.slice(dataOffset, dataOffset + compressedSize);
    const inflated = method === 0
      ? compressed
      : method === 8
        ? new Uint8Array(inflateRawSync(compressed, { maxOutputLength: ZIP_ENTRY_MAX_INFLATED_BYTES }))
        : null;
    if (!inflated || inflated.byteLength !== uncompressedSize) throw new Error('invalid_zip');
    totalInflatedBytes += inflated.byteLength;
    entries.set(filename, inflated);
    centralOffset += 46 + filenameLength + extraLength + commentLength;
  }
  return entries;
}

function parseRelationships(xml: string) {
  const relationships = new Map<string, string>();
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/?\s*>/gu)) {
    const id = /\bId="([^"]+)"/u.exec(match[1])?.[1];
    const target = /\bTarget="([^"]+)"/u.exec(match[1])?.[1];
    if (!id || !target || target.includes('..') || target.includes('\\')) continue;
    relationships.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  }
  return relationships;
}

function columnName(reference: string) {
  return /^([A-Z]{1,3})[1-9]\d*$/u.exec(reference)?.[1] ?? null;
}

function parseSheetRows(xml: string, sharedStrings: readonly string[]) {
  if (/<(?:[A-Za-z_][\w.-]*:)?f(?:\s|>)/u.test(xml)) throw new Error('formula_not_allowed');
  const rows = new Map<number, CellMap>();
  for (const rowMatch of xml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?row\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?row>/gu)) {
    const rowNumber = Number.parseInt(/\br="(\d+)"/u.exec(rowMatch[1])?.[1] ?? '', 10);
    if (!Number.isSafeInteger(rowNumber) || rowNumber < 1) continue;
    const cells = new Map<string, string>();
    for (const cellMatch of rowMatch[2].matchAll(/<(?:[A-Za-z_][\w.-]*:)?c\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?c>/gu)) {
      const reference = /\br="([A-Z]{1,3}\d+)"/u.exec(cellMatch[1])?.[1] ?? '';
      const column = columnName(reference);
      if (!column) continue;
      const type = /\bt="([^"]+)"/u.exec(cellMatch[1])?.[1];
      let value = '';
      if (type === 'inlineStr') {
        value = [...cellMatch[2].matchAll(/<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/gu)]
          .map((match) => decodeXmlText(match[1]))
          .join('');
      } else {
        value = decodeXmlText(/<(?:[A-Za-z_][\w.-]*:)?v>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?v>/u.exec(cellMatch[2])?.[1] ?? '');
        if (type === 's') {
          const sharedIndex = Number.parseInt(value, 10);
          value = Number.isSafeInteger(sharedIndex) ? sharedStrings[sharedIndex] ?? '' : '';
        }
      }
      cells.set(column, value.trim());
    }
    if ([...cells.values()].some(Boolean)) rows.set(rowNumber, cells);
  }
  return rows;
}

export function parseInstitutionExcelWorkbookEntriesV1(
  entries: ReadonlyMap<string, Uint8Array>,
): readonly ParsedSheet[] {
  const workbookBytes = entries.get('xl/workbook.xml');
  const relationshipBytes = entries.get('xl/_rels/workbook.xml.rels');
  if (!workbookBytes || !relationshipBytes) throw new Error('workbook_missing');
  const sharedStrings = entries.has('xl/sharedStrings.xml')
    ? [...decodeUtf8(entries.get('xl/sharedStrings.xml') ?? new Uint8Array()).matchAll(/<(?:[A-Za-z_][\w.-]*:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?si>/gu)].map(
      (match) => [...match[1].matchAll(/<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/gu)]
        .map((textMatch) => decodeXmlText(textMatch[1]))
        .join(''),
    )
    : [];
  const relationships = parseRelationships(decodeUtf8(relationshipBytes));
  const workbookXml = decodeUtf8(workbookBytes);
  const sheets: ParsedSheet[] = [];
  for (const match of workbookXml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?sheet\b([^>]*)\/?\s*>/gu)) {
    const name = decodeXmlText(/\bname="([^"]+)"/u.exec(match[1])?.[1] ?? '');
    const relationshipId = /\br:id="([^"]+)"/u.exec(match[1])?.[1] ?? '';
    const path = relationships.get(relationshipId);
    const bytes = path ? entries.get(path) : null;
    if (!name || !bytes) throw new Error('sheet_missing');
    sheets.push(Object.freeze({ name, rows: parseSheetRows(decodeUtf8(bytes), sharedStrings) }));
  }
  return Object.freeze(sheets);
}

function cell(row: CellMap, index: number) {
  let column = '';
  let value = index + 1;
  while (value > 0) {
    value -= 1;
    column = String.fromCharCode(65 + (value % 26)) + column;
    value = Math.floor(value / 26);
  }
  return row.get(column) ?? '';
}

function safeText(value: string, maxLength: number, required: boolean) {
  if (
    (required && value.length === 0) ||
    [...value].length > maxLength ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return null;
  }
  return value;
}

function excelSerialToDate(value: string, withTime: boolean) {
  if (/^\d+(?:\.\d+)?$/u.test(value)) {
    const serial = Number(value);
    if (!Number.isFinite(serial) || serial < 1 || serial > 2_958_465) return null;
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86_400_000));
    return withTime
      ? new Date(date.getTime() - 8 * 60 * 60 * 1000).toISOString()
      : date.toISOString().slice(0, 10);
  }
  if (withTime) {
    const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/u.exec(value);
    if (!match) return null;
    const parsed = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] ?? '00'}+08:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

function appointmentStatus(value: string): AppointmentCommandStatus | null {
  return ({
    待确认: 'pending_confirmation', 已确认: 'confirmed', 已到店: 'arrived',
    已完成: 'completed', 已取消: 'cancelled', 异常: 'reschedule_requested',
  } as const)[value] ?? null;
}

function consumptionEventType(value: string): AnalyticsConsumptionEventType | null {
  return ({
    已支付: 'payment_succeeded', 待支付: 'payment_pending', 支付失败: 'payment_failed',
    已取消: 'payment_cancelled', 退款: 'refund_confirmed', 部分退款: 'refund_confirmed',
    退款中: 'refund_pending', 退款失败: 'refund_failed', 退款取消: 'refund_cancelled',
  } as const)[value] ?? null;
}

function addIssue(
  issues: InstitutionExcelImportIssueV1[],
  sheet: string,
  row: number | null,
  field: string | null,
  code: string,
) {
  if (issues.length < ISSUE_LIMIT) issues.push(Object.freeze({ sheet, row, field, code }));
}

function assertHeaders(sheets: readonly ParsedSheet[], issues: InstitutionExcelImportIssueV1[]) {
  for (const [sheetName, headers] of Object.entries(expectedHeaders)) {
    const sheet = sheets.find((candidate) => candidate.name === sheetName);
    if (!sheet) {
      addIssue(issues, sheetName, null, null, 'sheet_missing');
      continue;
    }
    const headerRow = sheet.rows.get(3) ?? new Map<string, string>();
    headers.forEach((header, index) => {
      if (cell(headerRow, index) !== header) addIssue(issues, sheetName, 3, header, 'header_mismatch');
    });
  }
}

function dataRows(sheet: ParsedSheet) {
  return [...sheet.rows.entries()].filter(([rowNumber]) => rowNumber >= 5);
}

function parseWorkbookSheets(sheets: readonly ParsedSheet[]): InstitutionExcelImportParseResultV1 {
  const issues: InstitutionExcelImportIssueV1[] = [];
  assertHeaders(sheets, issues);
  if (issues.length > 0) return Object.freeze({ kind: 'invalid', code: 'invalid_template', issues });

  const customers: InstitutionExcelCustomerRowV1[] = [];
  const appointments: InstitutionExcelAppointmentRowV1[] = [];
  const treatments: InstitutionExcelTreatmentRowV1[] = [];
  const consumptions: InstitutionExcelConsumptionRowV1[] = [];
  const customerRefs = new Set<string>();
  const entityRefs = new Set<string>();

  for (const [rowNumber, row] of dataRows(sheets.find((sheet) => sheet.name === '客户基本信息')!)) {
    const externalReference = safeText(cell(row, 0), 96, true);
    const displayName = safeText(cell(row, 1), 120, true);
    const phone = safeText(cell(row, 2), 32, true);
    const birthDate = cell(row, 4) ? excelSerialToDate(cell(row, 4), false) : '';
    if (!externalReference) addIssue(issues, '客户基本信息', rowNumber, '客户外部编号*', 'invalid_required_value');
    if (!displayName) addIssue(issues, '客户基本信息', rowNumber, '姓名*', 'invalid_required_value');
    if (!phone || !/^1\d{10}$/u.test(phone)) addIssue(issues, '客户基本信息', rowNumber, '手机号*', 'invalid_phone');
    if (cell(row, 4) && !birthDate) addIssue(issues, '客户基本信息', rowNumber, '出生日期', 'invalid_date');
    if (externalReference && customerRefs.has(externalReference)) addIssue(issues, '客户基本信息', rowNumber, '客户外部编号*', 'duplicate_reference');
    if (externalReference) customerRefs.add(externalReference);
    if (externalReference && displayName && phone && /^1\d{10}$/u.test(phone) && birthDate !== null) {
      customers.push(Object.freeze({
        rowNumber, externalReference, displayName, phone,
        gender: safeText(cell(row, 3), 20, false) ?? '',
        birthDate: birthDate ?? '',
        nationalId: safeText(cell(row, 5), 32, false) ?? '',
        externalPatientId: safeText(cell(row, 6), 96, false) ?? '',
        source: safeText(cell(row, 7), 80, false) ?? '',
        acquisitionSource: safeText(cell(row, 8), 80, false) ?? '',
        owner: safeText(cell(row, 9), 96, false) ?? '',
        createdAt: cell(row, 10) ? excelSerialToDate(cell(row, 10), true) ?? '' : '',
        notes: safeText(cell(row, 11), 1_000, false) ?? '',
      }));
    }
  }

  function requireBusinessReference(sheet: string, rowNumber: number, externalRef: string, customerRef: string) {
    if (!safeText(externalRef, 96, true)) addIssue(issues, sheet, rowNumber, '外部编号', 'invalid_required_value');
    if (!safeText(customerRef, 96, true) || !customerRefs.has(customerRef)) addIssue(issues, sheet, rowNumber, '客户外部编号*', 'customer_reference_not_found');
    const key = `${sheet}:${externalRef}`;
    if (externalRef && entityRefs.has(key)) addIssue(issues, sheet, rowNumber, '外部编号', 'duplicate_reference');
    if (externalRef) entityRefs.add(key);
  }

  for (const [rowNumber, row] of dataRows(sheets.find((sheet) => sheet.name === '预约记录')!)) {
    const externalReference = cell(row, 0);
    const customerExternalReference = cell(row, 1);
    requireBusinessReference('预约记录', rowNumber, externalReference, customerExternalReference);
    const scheduledAt = excelSerialToDate(cell(row, 2), true);
    const project = safeText(cell(row, 3), 160, true);
    const status = appointmentStatus(cell(row, 6));
    if (!scheduledAt) addIssue(issues, '预约记录', rowNumber, '预约日期时间*', 'invalid_datetime');
    if (!project) addIssue(issues, '预约记录', rowNumber, '预约项目*', 'invalid_required_value');
    if (!status) addIssue(issues, '预约记录', rowNumber, '预约状态', 'invalid_status');
    if (externalReference && customerRefs.has(customerExternalReference) && scheduledAt && project && status) {
      appointments.push(Object.freeze({
        rowNumber, externalReference, customerExternalReference, scheduledAt, project,
        consultant: safeText(cell(row, 4), 96, false) ?? '',
        resource: safeText(cell(row, 5), 160, false) ?? '', status,
        source: safeText(cell(row, 7), 80, false) ?? '',
        hisAppointmentId: safeText(cell(row, 8), 96, false) ?? '',
        createdBy: safeText(cell(row, 9), 96, false) ?? '',
        notes: safeText(cell(row, 10), 1_000, false) ?? '',
      }));
    }
  }

  for (const [rowNumber, row] of dataRows(sheets.find((sheet) => sheet.name === '治疗记录')!)) {
    const externalReference = cell(row, 0);
    const customerExternalReference = cell(row, 1);
    requireBusinessReference('治疗记录', rowNumber, externalReference, customerExternalReference);
    const treatmentAt = excelSerialToDate(cell(row, 2), true);
    const project = safeText(cell(row, 3), 160, true);
    const status = safeText(cell(row, 6), 120, true);
    if (!treatmentAt) addIssue(issues, '治疗记录', rowNumber, '治疗日期时间*', 'invalid_datetime');
    if (!project) addIssue(issues, '治疗记录', rowNumber, '治疗项目*', 'invalid_required_value');
    if (!status || !['计划中', '进行中', '已完成', '已取消'].includes(status)) addIssue(issues, '治疗记录', rowNumber, '治疗状态', 'invalid_status');
    if (externalReference && customerRefs.has(customerExternalReference) && treatmentAt && project && status) {
      treatments.push(Object.freeze({
        rowNumber, externalReference, customerExternalReference, treatmentAt, project,
        doctor: safeText(cell(row, 4), 96, false) ?? '',
        department: safeText(cell(row, 5), 160, false) ?? '', status,
        source: safeText(cell(row, 7), 80, false) ?? '',
        sourceRecordId: safeText(cell(row, 8), 256, false) ?? '',
        notes: safeText(cell(row, 9), 1_000, false) ?? '',
      }));
    }
  }

  for (const [rowNumber, row] of dataRows(sheets.find((sheet) => sheet.name === '消费记录')!)) {
    const externalReference = cell(row, 0);
    const customerExternalReference = cell(row, 1);
    requireBusinessReference('消费记录', rowNumber, externalReference, customerExternalReference);
    const eventAt = excelSerialToDate(cell(row, 2), true);
    const project = safeText(cell(row, 3), 160, true);
    const amount = Number(cell(row, 4));
    const amountMinor = Number.isFinite(amount) ? Math.round(amount * 100) : 0;
    const currency = (cell(row, 5) || 'CNY').toUpperCase();
    const eventType = consumptionEventType(cell(row, 7));
    if (!eventAt) addIssue(issues, '消费记录', rowNumber, '消费日期时间*', 'invalid_datetime');
    if (!project) addIssue(issues, '消费记录', rowNumber, '消费项目*', 'invalid_required_value');
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 1) addIssue(issues, '消费记录', rowNumber, '消费金额*', 'invalid_amount');
    if (!/^[A-Z]{3}$/u.test(currency)) addIssue(issues, '消费记录', rowNumber, '币种', 'invalid_currency');
    if (!eventType) addIssue(issues, '消费记录', rowNumber, '支付状态', 'invalid_status');
    if (externalReference && customerRefs.has(customerExternalReference) && eventAt && project && amountMinor > 0 && eventType) {
      consumptions.push(Object.freeze({
        rowNumber, externalReference, customerExternalReference, eventAt, project, amountMinor, currency,
        orderReference: safeText(cell(row, 6), 256, false) ?? '', eventType,
        source: safeText(cell(row, 8), 80, false) ?? '',
        sourceRecordId: safeText(cell(row, 9), 256, false) ?? '',
        notes: safeText(cell(row, 10), 1_000, false) ?? '',
      }));
    }
  }

  const totalRows = customers.length + appointments.length + treatments.length + consumptions.length;
  if (customers.length === 0) addIssue(issues, '客户基本信息', null, null, 'customer_rows_required');
  if (totalRows > INSTITUTION_EXCEL_IMPORT_MAX_ROWS) addIssue(issues, 'workbook', null, null, 'row_limit_exceeded');
  if (issues.length > 0) return Object.freeze({ kind: 'invalid', code: 'validation_failed', issues });
  return Object.freeze({
    kind: 'ready',
    workbook: Object.freeze({
      customers: Object.freeze(customers), appointments: Object.freeze(appointments),
      treatments: Object.freeze(treatments), consumptions: Object.freeze(consumptions),
    }),
  });
}

export function parseInstitutionExcelImportEntriesV1(
  entries: ReadonlyMap<string, Uint8Array>,
): InstitutionExcelImportParseResultV1 {
  try {
    return parseWorkbookSheets(parseInstitutionExcelWorkbookEntriesV1(entries));
  } catch {
    return Object.freeze({ kind: 'invalid', code: 'invalid_xlsx', issues: [] });
  }
}

export function parseInstitutionExcelImportWorkbookV1(
  content: Uint8Array,
): InstitutionExcelImportParseResultV1 {
  if (content.byteLength < 4 || content.byteLength > INSTITUTION_EXCEL_IMPORT_MAX_BYTES) {
    return Object.freeze({ kind: 'invalid', code: 'invalid_file_size', issues: [] });
  }
  try {
    return parseInstitutionExcelImportEntriesV1(readZipEntries(content));
  } catch {
    return Object.freeze({ kind: 'invalid', code: 'invalid_xlsx', issues: [] });
  }
}
