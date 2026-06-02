import type { FollowUpRiskLevel } from '@/modules/institution/domain/followup-workflow';
import type {
  CreateTreatmentSummaryDraft,
  TreatmentSummaryVoidReasonCode,
  UpdateTreatmentSummaryDraft,
  VoidTreatmentSummaryDraft,
} from '@/modules/institution/domain/treatment-summaries';
import { treatmentSummaryVoidReasonCodes } from '@/modules/institution/domain/treatment-summaries';

export type ParseCreateTreatmentSummaryPayloadResult =
  | { ok: true; value: CreateTreatmentSummaryDraft }
  | { ok: false; error: string };
export type ParseUpdateTreatmentSummaryPayloadResult =
  | { ok: true; value: UpdateTreatmentSummaryDraft }
  | { ok: false; error: string };
export type ParseVoidTreatmentSummaryPayloadResult =
  | { ok: true; value: VoidTreatmentSummaryDraft }
  | { ok: false; error: string };

const ALLOWED_CREATE_TREATMENT_SUMMARY_KEYS = [
  'appointmentId',
  'treatmentDate',
  'treatmentProject',
  'treatmentCategory',
  'treatmentStage',
  'recoveryStage',
  'riskLevel',
  'ownerUserId',
  'summary',
  'nextCareAction',
  'tags',
] as const satisfies readonly (keyof CreateTreatmentSummaryDraft)[];

const allowedCreateTreatmentSummaryKeys = new Set<string>(
  ALLOWED_CREATE_TREATMENT_SUMMARY_KEYS,
);
const allowedUpdateTreatmentSummaryKeys = new Set<string>(
  ALLOWED_CREATE_TREATMENT_SUMMARY_KEYS,
);
const allowedVoidTreatmentSummaryKeys = new Set<string>(['reasonCode', 'reasonText']);

const treatmentSummaryStringFieldLimits = {
  treatmentProject: 160,
  treatmentCategory: 96,
  treatmentStage: 120,
  recoveryStage: 120,
  ownerUserId: 96,
  summary: 280,
  nextCareAction: 200,
} as const;

type TreatmentSummaryStringField = keyof typeof treatmentSummaryStringFieldLimits;

const treatmentSummaryRiskLevels = [
  'normal',
  'watch',
  'urgent',
] as const satisfies readonly FollowUpRiskLevel[];

const treatmentSummaryRiskLevelSet = new Set<string>(treatmentSummaryRiskLevels);
const treatmentSummaryVoidReasonCodeSet = new Set<string>(treatmentSummaryVoidReasonCodes);

const isoLikeTimestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/u;

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

function normalizeDigits(input: string) {
  return input
    .normalize('NFKC')
    .replace(/[٠-٩]/gu, (char) => String(char.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/gu, (char) => String(char.charCodeAt(0) - 0x6f0));
}

function containsRawIdentifier(input: string) {
  const normalized = normalizeDigits(input);
  const compactDigits = normalized.replace(/\D/gu, '');

  return (
    compactDigits.length >= 11 ||
    /(?:身份证号?|身分證號?|id\s*number|idNumber)[\s\S]{0,40}\d/iu.test(normalized) ||
    /(?:病历号|病歷號|medical\s*record|rawMedicalRecordNo|MR[-_\s]*RAW)[\s\S]{0,40}\d/iu.test(
      normalized,
    )
  );
}

function containsDisallowedTreatmentSummaryContent(input: string) {
  const normalized = normalizeDigits(input);

  return (
    containsRawIdentifier(normalized) ||
    /完整治疗记录正文|完整病历正文|诊疗原文|咨询对话全文|手机号原文|身份证号|病历号原文|图片\s*\/\s*文件原文|图片原文|文件原文|AI\s*生成内容|外部系统\s*payload|外部系统原文|请求体/u.test(
      normalized,
    ) ||
    /full\s*treatment\s*record|medical\s*record\s*text|diagnosis\s*text|consultation\s*transcript/iu.test(
      normalized,
    ) ||
    /imageUrl|fileUrl|image\s*url|file\s*url/iu.test(normalized) ||
    /aiGeneratedContent|AI\s*生成|ai\s*generated/iu.test(normalized) ||
    /externalSystemPayload|外部系统同步原文|external\s*system|requestBody/iu.test(
      normalized,
    ) ||
    /DATABASE_URL|database_url|postgres:\/\/|mysql:\/\/|mongodb:\/\/|redis:\/\//iu.test(
      normalized,
    ) ||
    /\b(?:sql|stack|token|secret)\b/iu.test(normalized) ||
    /sk_(?:live|test|proj)_|zmtg_sk_/iu.test(normalized)
  );
}

function parseObject(input: unknown, allowedKeys: ReadonlySet<string>) {
  if (!isPlainObject(input)) {
    return { ok: false as const, error: '请求体必须是 JSON object' };
  }

  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      return { ok: false as const, error: `请求包含不允许的字段: ${key}` };
    }
  }

  return { ok: true as const, value: input };
}

function parseRequiredStringField(
  input: Record<string, unknown>,
  field: TreatmentSummaryStringField,
) {
  const raw = input[field];

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false as const, error: `字段 ${field} 必须是非空字符串` };
  }

  const value = raw.trim();
  const limit = treatmentSummaryStringFieldLimits[field];

  if (value.length > limit) {
    return { ok: false as const, error: `字段 ${field} 长度不能超过 ${limit}` };
  }

  if (containsDisallowedTreatmentSummaryContent(value)) {
    return { ok: false as const, error: `字段 ${field} 不允许包含敏感信息` };
  }

  return { ok: true as const, value };
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
  if (day < 1 || day > daysInMonth) {
    return false;
  }

  if (hour > 23 || minute > 59 || second > 59) {
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

function parseTreatmentDate(input: Record<string, unknown>) {
  const raw = input.treatmentDate;

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false as const, error: '字段 treatmentDate 必须是非空字符串' };
  }

  const value = raw.trim();
  const parsedAt = Date.parse(value);

  if (!Number.isFinite(parsedAt) || !isValidIsoLikeTimestamp(value)) {
    return { ok: false as const, error: '字段 treatmentDate 必须是有效时间字符串' };
  }

  return { ok: true as const, value: new Date(parsedAt).toISOString() };
}

function parseRiskLevel(input: Record<string, unknown>) {
  const raw = input.riskLevel;

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false as const, error: '字段 riskLevel 必须是非空字符串' };
  }

  const value = raw.trim();
  if (!treatmentSummaryRiskLevelSet.has(value)) {
    return { ok: false as const, error: '字段 riskLevel 值不在允许范围内' };
  }

  return { ok: true as const, value: value as FollowUpRiskLevel };
}

function parseAppointmentId(input: Record<string, unknown>) {
  if (!('appointmentId' in input) || input.appointmentId == null) {
    return { ok: true as const, value: null };
  }

  if (typeof input.appointmentId !== 'string') {
    return { ok: false as const, error: '字段 appointmentId 必须是字符串' };
  }

  const value = input.appointmentId.trim();
  if (value.length === 0) {
    return { ok: true as const, value: null };
  }

  if (value.length > 64) {
    return { ok: false as const, error: '字段 appointmentId 长度不能超过 64' };
  }

  if (containsDisallowedTreatmentSummaryContent(value)) {
    return { ok: false as const, error: '字段 appointmentId 不允许包含敏感信息' };
  }

  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    return { ok: false as const, error: '字段 appointmentId 格式不正确' };
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
    normalizedTags.some(containsDisallowedTreatmentSummaryContent) ||
    containsDisallowedTreatmentSummaryContent(normalizedTags.join(' '))
  ) {
    return { ok: false as const, error: '字段 tags 不允许包含敏感信息' };
  }

  return { ok: true as const, value: normalizedTags };
}

export function parseCreateTreatmentSummaryPayload(
  input: unknown,
): ParseCreateTreatmentSummaryPayloadResult {
  const object = parseObject(input, allowedCreateTreatmentSummaryKeys);
  if (!object.ok) {
    return object;
  }

  const treatmentDate = parseTreatmentDate(object.value);
  if (!treatmentDate.ok) {
    return treatmentDate;
  }

  const treatmentProject = parseRequiredStringField(object.value, 'treatmentProject');
  if (!treatmentProject.ok) {
    return treatmentProject;
  }

  const treatmentCategory = parseRequiredStringField(object.value, 'treatmentCategory');
  if (!treatmentCategory.ok) {
    return treatmentCategory;
  }

  const treatmentStage = parseRequiredStringField(object.value, 'treatmentStage');
  if (!treatmentStage.ok) {
    return treatmentStage;
  }

  const recoveryStage = parseRequiredStringField(object.value, 'recoveryStage');
  if (!recoveryStage.ok) {
    return recoveryStage;
  }

  const riskLevel = parseRiskLevel(object.value);
  if (!riskLevel.ok) {
    return riskLevel;
  }

  const ownerUserId = parseRequiredStringField(object.value, 'ownerUserId');
  if (!ownerUserId.ok) {
    return ownerUserId;
  }

  const summary = parseRequiredStringField(object.value, 'summary');
  if (!summary.ok) {
    return summary;
  }

  const nextCareAction = parseRequiredStringField(object.value, 'nextCareAction');
  if (!nextCareAction.ok) {
    return nextCareAction;
  }

  const tags = parseTags(object.value);
  if (!tags.ok) {
    return tags;
  }

  const appointmentId = parseAppointmentId(object.value);
  if (!appointmentId.ok) {
    return appointmentId;
  }

  return {
    ok: true,
    value: {
      treatmentDate: treatmentDate.value,
      treatmentProject: treatmentProject.value,
      treatmentCategory: treatmentCategory.value,
      treatmentStage: treatmentStage.value,
      recoveryStage: recoveryStage.value,
      riskLevel: riskLevel.value,
      ownerUserId: ownerUserId.value,
      summary: summary.value,
      nextCareAction: nextCareAction.value,
      tags: tags.value,
      appointmentId: appointmentId.value,
    },
  };
}

export function parseUpdateTreatmentSummaryPayload(
  input: unknown,
): ParseUpdateTreatmentSummaryPayloadResult {
  const object = parseObject(input, allowedUpdateTreatmentSummaryKeys);
  if (!object.ok) {
    return object;
  }

  if (Object.keys(object.value).length === 0) {
    return { ok: false, error: '至少需要提供一个可更新字段' };
  }

  const value: UpdateTreatmentSummaryDraft = {};

  if ('treatmentDate' in object.value) {
    const treatmentDate = parseTreatmentDate(object.value);
    if (!treatmentDate.ok) {
      return treatmentDate;
    }
    value.treatmentDate = treatmentDate.value;
  }

  for (const field of [
    'treatmentProject',
    'treatmentCategory',
    'treatmentStage',
    'recoveryStage',
    'ownerUserId',
    'summary',
    'nextCareAction',
  ] as const satisfies readonly TreatmentSummaryStringField[]) {
    if (field in object.value) {
      const parsed = parseRequiredStringField(object.value, field);
      if (!parsed.ok) {
        return parsed;
      }
      value[field] = parsed.value;
    }
  }

  if ('riskLevel' in object.value) {
    const riskLevel = parseRiskLevel(object.value);
    if (!riskLevel.ok) {
      return riskLevel;
    }
    value.riskLevel = riskLevel.value;
  }

  if ('tags' in object.value) {
    const tags = parseTags(object.value);
    if (!tags.ok) {
      return tags;
    }
    value.tags = tags.value;
  }

  if ('appointmentId' in object.value) {
    const appointmentId = parseAppointmentId(object.value);
    if (!appointmentId.ok) {
      return appointmentId;
    }
    value.appointmentId = appointmentId.value;
  }

  return { ok: true, value };
}

function parseVoidReasonCode(
  input: Record<string, unknown>,
): { ok: true; value: TreatmentSummaryVoidReasonCode } | { ok: false; error: string } {
  const raw = input.reasonCode;

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, error: '字段 reasonCode 必须是非空字符串' };
  }

  const value = raw.trim();
  if (!treatmentSummaryVoidReasonCodeSet.has(value)) {
    return { ok: false, error: '字段 reasonCode 值不在允许范围内' };
  }

  return { ok: true, value: value as TreatmentSummaryVoidReasonCode };
}

function parseVoidReasonText(
  input: Record<string, unknown>,
): { ok: true; value: string } | { ok: false; error: string } {
  const raw = input.reasonText;

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, error: '字段 reasonText 必须是非空字符串' };
  }

  const value = raw.trim();

  if (value.length > 160) {
    return { ok: false, error: '字段 reasonText 长度不能超过 160' };
  }

  if (containsDisallowedTreatmentSummaryContent(value)) {
    return { ok: false, error: '字段 reasonText 不允许包含敏感信息' };
  }

  return { ok: true, value };
}

export function parseVoidTreatmentSummaryPayload(
  input: unknown,
): ParseVoidTreatmentSummaryPayloadResult {
  const object = parseObject(input, allowedVoidTreatmentSummaryKeys);
  if (!object.ok) {
    return object;
  }

  const reasonCode = parseVoidReasonCode(object.value);
  if (!reasonCode.ok) {
    return reasonCode;
  }

  const reasonText = parseVoidReasonText(object.value);
  if (!reasonText.ok) {
    return reasonText;
  }

  return {
    ok: true,
    value: {
      reasonCode: reasonCode.value,
      reasonText: reasonText.value,
    },
  };
}
