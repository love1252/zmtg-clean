import {
  STANDARD_TREATMENT_EVENT_ALLOWED_INPUT_KEYS,
  STANDARD_TREATMENT_EVENT_RISK_LEVELS,
  STANDARD_TREATMENT_EVENT_SOURCE_SYSTEMS,
  STANDARD_TREATMENT_EVENT_STATUSES,
} from '@/modules/institution/domain/standard-treatment-event';
import type {
  StandardTreatmentEvent,
  StandardTreatmentEventRiskLevel,
  StandardTreatmentEventSourceSystem,
  StandardTreatmentEventStatus,
} from '@/modules/institution/domain/standard-treatment-event';

export type StandardTreatmentEventMapperContext = {
  tenantId: string;
  eventId: string;
  receivedAt: string;
};

export type NormalizeStandardTreatmentEventResult =
  | { ok: true; value: StandardTreatmentEvent }
  | { ok: false; error: string };

const allowedInputKeys = new Set<string>(STANDARD_TREATMENT_EVENT_ALLOWED_INPUT_KEYS);
const sourceSystemSet = new Set<string>(STANDARD_TREATMENT_EVENT_SOURCE_SYSTEMS);
const treatmentStatusSet = new Set<string>(STANDARD_TREATMENT_EVENT_STATUSES);
const riskLevelSet = new Set<string>(STANDARD_TREATMENT_EVENT_RISK_LEVELS);

const isoLikeTimestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/u;

const stringFieldLimits = {
  sourceEventId: 120,
  sourceCustomerId: 120,
  customerMatchKey: 160,
  customerName: 80,
  treatmentProject: 160,
  treatmentCategory: 96,
  treatmentStage: 120,
  appointmentRef: 120,
  doctorRef: 120,
  operatorRef: 120,
  departmentRef: 120,
  summary: 280,
  nextCareAction: 200,
} as const;

type StringField = keyof typeof stringFieldLimits;

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

function normalizeDigits(input: string) {
  return input
    .normalize('NFKC')
    .replace(/[٠-٩]/gu, (char) => String(char.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/gu, (char) => String(char.charCodeAt(0) - 0x6f0));
}

function containsRawPhone(input: string) {
  const normalized = normalizeDigits(input);

  return /(?:\+?86[-\s]?)?1[3-9]\d(?:[-\s]?\d){8}/u.test(normalized);
}

function containsIdNumber(input: string) {
  const normalized = normalizeDigits(input);

  return /\d{17}[\dXx]/u.test(normalized);
}

function containsSensitiveContent(input: string) {
  const normalized = normalizeDigits(input);

  return (
    containsRawPhone(normalized) ||
    containsIdNumber(normalized) ||
    /(?:身份证号?|身分證號?|id\s*number|idNumber)[\s\S]{0,40}\d/iu.test(normalized) ||
    /(?:病历号|病歷號|medical\s*record|rawMedicalRecordNo|MR[-_\s]*RAW)[\s\S]{0,40}\d/iu.test(
      normalized,
    ) ||
    /HIS\s*raw\s*payload|raw\s*payload|hisRawPayload|externalRawPayload/iu.test(
      normalized,
    ) ||
    /完整治疗记录正文|完整病历正文|诊疗原文|咨询对话全文/u.test(normalized) ||
    /full\s*treatment\s*record|medical\s*record\s*text|diagnosis\s*text|clinical\s*note|consultation\s*transcript/iu.test(
      normalized,
    ) ||
    /imageUrl|fileUrl|beforePhotoUrl|afterPhotoUrl|图片原文|文件原文|术前术后照片原文|image\s*url|file\s*url/iu.test(
      normalized,
    ) ||
    /aiGeneratedContent|AI\s*生成|ai\s*generated|ai\s*prompt|ai\s*completion|embedding/iu.test(
      normalized,
    ) ||
    /DATABASE_URL|database_url|postgres:\/\/|mysql:\/\/|mongodb:\/\/|redis:\/\//iu.test(
      normalized,
    ) ||
    /\b(?:sql|select|insert|update|delete|drop|stack|token|secret|apiKey|oauthToken|webhookSecret)\b/iu.test(
      normalized,
    ) ||
    /sk_(?:live|test|proj)_|zmtg_sk_/iu.test(normalized)
  );
}

function parseObject(input: unknown) {
  if (!isPlainObject(input)) {
    return { ok: false as const, error: '输入必须是 JSON object' };
  }

  for (const key of Object.keys(input)) {
    if (!allowedInputKeys.has(key)) {
      return { ok: false as const, error: `请求包含不允许的字段: ${key}` };
    }
  }

  return { ok: true as const, value: input };
}

function isValidIsoLikeTimestamp(value: string) {
  const match = isoLikeTimestampPattern.exec(value);
  if (!match) {
    return false;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zoneText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = secondText === undefined ? 0 : Number(secondText);

  if (month < 1 || month > 12) {
    return false;
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59) {
    return false;
  }

  if (zoneText !== 'Z') {
    const zoneHour = Number(zoneText.slice(1, 3));
    const zoneMinute = Number(zoneText.slice(4, 6));
    if (zoneHour > 23 || zoneMinute > 59) {
      return false;
    }
  }

  return !Number.isNaN(new Date(value).getTime());
}

function parseTimestamp(input: Record<string, unknown>, field: 'treatmentDate' | 'occurredAt') {
  const raw = input[field];

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false as const, error: `字段 ${field} 必须是非空字符串` };
  }

  const value = raw.trim();
  const parsedAt = Date.parse(value);

  if (!Number.isFinite(parsedAt) || !isValidIsoLikeTimestamp(value)) {
    return { ok: false as const, error: `字段 ${field} 必须是有效时间字符串` };
  }

  return { ok: true as const, value: new Date(parsedAt).toISOString() };
}

function parseContextTimestamp(value: string, field: 'receivedAt') {
  const parsedAt = Date.parse(value);

  if (!Number.isFinite(parsedAt) || !isValidIsoLikeTimestamp(value)) {
    return { ok: false as const, error: `字段 ${field} 必须是有效时间字符串` };
  }

  return { ok: true as const, value: new Date(parsedAt).toISOString() };
}

function parseRequiredString(input: Record<string, unknown>, field: StringField) {
  const raw = input[field];

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false as const, error: `字段 ${field} 必须是非空字符串` };
  }

  const value = raw.trim();
  const limit = stringFieldLimits[field];

  if (value.length > limit) {
    return { ok: false as const, error: `字段 ${field} 长度不能超过 ${limit}` };
  }

  if (containsSensitiveContent(value)) {
    return { ok: false as const, error: `字段 ${field} 不允许包含敏感信息` };
  }

  return { ok: true as const, value };
}

function parseOptionalString(input: Record<string, unknown>, field: StringField) {
  if (!(field in input) || input[field] == null) {
    return { ok: true as const, value: null };
  }

  const raw = input[field];
  if (typeof raw !== 'string') {
    return { ok: false as const, error: `字段 ${field} 必须是字符串` };
  }

  const value = raw.trim();
  if (value.length === 0) {
    return { ok: true as const, value: null };
  }

  const limit = stringFieldLimits[field];
  if (value.length > limit) {
    return { ok: false as const, error: `字段 ${field} 长度不能超过 ${limit}` };
  }

  if (containsSensitiveContent(value)) {
    return { ok: false as const, error: `字段 ${field} 不允许包含敏感信息` };
  }

  return { ok: true as const, value };
}

function parseSourceSystem(input: Record<string, unknown>) {
  const raw = input.sourceSystem;

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false as const, error: '字段 sourceSystem 必须是非空字符串' };
  }

  const value = raw.trim();
  if (!sourceSystemSet.has(value)) {
    return { ok: false as const, error: '字段 sourceSystem 值不在允许范围内' };
  }

  return { ok: true as const, value: value as StandardTreatmentEventSourceSystem };
}

function parseTreatmentStatus(input: Record<string, unknown>) {
  const raw = input.treatmentStatus;

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false as const, error: '字段 treatmentStatus 必须是非空字符串' };
  }

  const value = raw.trim();
  if (!treatmentStatusSet.has(value)) {
    return { ok: false as const, error: '字段 treatmentStatus 值不在允许范围内' };
  }

  return { ok: true as const, value: value as StandardTreatmentEventStatus };
}

function parseRiskLevel(input: Record<string, unknown>) {
  const raw = input.riskLevel;

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false as const, error: '字段 riskLevel 必须是非空字符串' };
  }

  const value = raw.trim();
  if (!riskLevelSet.has(value)) {
    return { ok: false as const, error: '字段 riskLevel 值不在允许范围内' };
  }

  return { ok: true as const, value: value as StandardTreatmentEventRiskLevel };
}

function parseMaskedPhone(input: Record<string, unknown>) {
  if (!('maskedPhone' in input) || input.maskedPhone == null) {
    return { ok: true as const, value: null };
  }

  if (typeof input.maskedPhone !== 'string') {
    return { ok: false as const, error: '字段 maskedPhone 必须是字符串' };
  }

  const value = input.maskedPhone.trim();
  if (value.length === 0) {
    return { ok: true as const, value: null };
  }

  if (!/^1[3-9]\d\*{4}\d{4}$/u.test(value)) {
    return { ok: false as const, error: '字段 maskedPhone 必须是脱敏展示值' };
  }

  return { ok: true as const, value };
}

function parseAmount(input: Record<string, unknown>) {
  if (!('amount' in input) || input.amount == null || input.amount === '') {
    return { ok: true as const, value: null };
  }

  if (typeof input.amount === 'number') {
    if (!Number.isFinite(input.amount) || input.amount < 0) {
      return { ok: false as const, error: '字段 amount 必须是非负金额' };
    }

    return { ok: true as const, value: String(input.amount) };
  }

  if (typeof input.amount !== 'string') {
    return { ok: false as const, error: '字段 amount 必须是金额字符串或数字' };
  }

  const value = input.amount.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/u.test(value)) {
    return { ok: false as const, error: '字段 amount 必须是非负金额' };
  }

  return { ok: true as const, value };
}

function parseCurrency(input: Record<string, unknown>) {
  if (!('currency' in input) || input.currency == null) {
    return { ok: true as const, value: null };
  }

  if (typeof input.currency !== 'string') {
    return { ok: false as const, error: '字段 currency 必须是字符串' };
  }

  const value = input.currency.trim().toUpperCase();
  if (value.length === 0) {
    return { ok: true as const, value: null };
  }

  if (!/^[A-Z]{3}$/u.test(value)) {
    return { ok: false as const, error: '字段 currency 必须是三位货币代码' };
  }

  return { ok: true as const, value };
}

function parseTags(input: Record<string, unknown>) {
  if (!('tags' in input)) {
    return { ok: true as const, value: [] };
  }

  if (!Array.isArray(input.tags)) {
    return { ok: false as const, error: '字段 tags 必须是字符串数组' };
  }

  const tags: string[] = [];
  for (const tag of input.tags) {
    if (typeof tag !== 'string') {
      return { ok: false as const, error: '字段 tags 必须是字符串数组' };
    }

    tags.push(tag.trim());
  }

  if (tags.some((tag) => tag.length === 0)) {
    return { ok: false as const, error: '字段 tags 必须是非空字符串数组' };
  }

  if (tags.some((tag) => tag.length > 40)) {
    return { ok: false as const, error: '字段 tags 单个标签长度不能超过 40' };
  }

  const normalizedTags = [...new Set(tags)];
  if (normalizedTags.length > 12) {
    return { ok: false as const, error: '字段 tags 数量不能超过 12' };
  }

  if (
    normalizedTags.some(containsSensitiveContent) ||
    containsSensitiveContent(normalizedTags.join(' '))
  ) {
    return { ok: false as const, error: '字段 tags 不允许包含敏感信息' };
  }

  return { ok: true as const, value: normalizedTags };
}

export function normalizeStandardTreatmentEvent(
  input: unknown,
  context: StandardTreatmentEventMapperContext,
): NormalizeStandardTreatmentEventResult {
  const object = parseObject(input);
  if (!object.ok) {
    return object;
  }

  const receivedAt = parseContextTimestamp(context.receivedAt, 'receivedAt');
  if (!receivedAt.ok) {
    return receivedAt;
  }

  const sourceSystem = parseSourceSystem(object.value);
  if (!sourceSystem.ok) {
    return sourceSystem;
  }

  const sourceEventId = parseOptionalString(object.value, 'sourceEventId');
  if (!sourceEventId.ok) {
    return sourceEventId;
  }

  const sourceCustomerId = parseOptionalString(object.value, 'sourceCustomerId');
  if (!sourceCustomerId.ok) {
    return sourceCustomerId;
  }

  const customerMatchKey = parseOptionalString(object.value, 'customerMatchKey');
  if (!customerMatchKey.ok) {
    return customerMatchKey;
  }

  const customerName = parseOptionalString(object.value, 'customerName');
  if (!customerName.ok) {
    return customerName;
  }

  const maskedPhone = parseMaskedPhone(object.value);
  if (!maskedPhone.ok) {
    return maskedPhone;
  }

  const treatmentDate = parseTimestamp(object.value, 'treatmentDate');
  if (!treatmentDate.ok) {
    return treatmentDate;
  }

  const treatmentProject = parseRequiredString(object.value, 'treatmentProject');
  if (!treatmentProject.ok) {
    return treatmentProject;
  }

  const treatmentCategory = parseRequiredString(object.value, 'treatmentCategory');
  if (!treatmentCategory.ok) {
    return treatmentCategory;
  }

  const treatmentStage = parseRequiredString(object.value, 'treatmentStage');
  if (!treatmentStage.ok) {
    return treatmentStage;
  }

  const treatmentStatus = parseTreatmentStatus(object.value);
  if (!treatmentStatus.ok) {
    return treatmentStatus;
  }

  const appointmentRef = parseOptionalString(object.value, 'appointmentRef');
  if (!appointmentRef.ok) {
    return appointmentRef;
  }

  const doctorRef = parseOptionalString(object.value, 'doctorRef');
  if (!doctorRef.ok) {
    return doctorRef;
  }

  const operatorRef = parseOptionalString(object.value, 'operatorRef');
  if (!operatorRef.ok) {
    return operatorRef;
  }

  const departmentRef = parseOptionalString(object.value, 'departmentRef');
  if (!departmentRef.ok) {
    return departmentRef;
  }

  const amount = parseAmount(object.value);
  if (!amount.ok) {
    return amount;
  }

  const currency = parseCurrency(object.value);
  if (!currency.ok) {
    return currency;
  }

  const riskLevel = parseRiskLevel(object.value);
  if (!riskLevel.ok) {
    return riskLevel;
  }

  const summary = parseRequiredString(object.value, 'summary');
  if (!summary.ok) {
    return summary;
  }

  const nextCareAction = parseRequiredString(object.value, 'nextCareAction');
  if (!nextCareAction.ok) {
    return nextCareAction;
  }

  const tags = parseTags(object.value);
  if (!tags.ok) {
    return tags;
  }

  const occurredAt = parseTimestamp(object.value, 'occurredAt');
  if (!occurredAt.ok) {
    return occurredAt;
  }

  return {
    ok: true,
    value: {
      tenantId: context.tenantId,
      eventId: context.eventId,
      sourceSystem: sourceSystem.value,
      sourceEventId: sourceEventId.value,
      sourceCustomerId: sourceCustomerId.value,
      customerMatchKey: customerMatchKey.value,
      customerName: customerName.value,
      maskedPhone: maskedPhone.value,
      treatmentDate: treatmentDate.value,
      treatmentProject: treatmentProject.value,
      treatmentCategory: treatmentCategory.value,
      treatmentStage: treatmentStage.value,
      treatmentStatus: treatmentStatus.value,
      appointmentRef: appointmentRef.value,
      doctorRef: doctorRef.value,
      operatorRef: operatorRef.value,
      departmentRef: departmentRef.value,
      amount: amount.value,
      currency: currency.value,
      riskLevel: riskLevel.value,
      summary: summary.value,
      nextCareAction: nextCareAction.value,
      tags: tags.value,
      occurredAt: occurredAt.value,
      receivedAt: receivedAt.value,
    },
  };
}
