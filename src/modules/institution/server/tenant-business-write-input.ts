import type { AppointmentStatus } from '@/modules/institution/domain/appointment-records';
import type {
  CustomerLifecycleStage,
  CustomerPriority,
} from '@/modules/institution/domain/customer-records';
import type { FollowUpStatus } from '@/modules/institution/domain/followup-workflow';

export type TenantBusinessWriteParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type CreateCustomerPayload = {
  displayName: string;
  lifecycle: CustomerLifecycleStage;
  priority: CustomerPriority;
  ownerUserId: string;
  projectInterest: string;
  maskedPhone: string;
  maskedMedicalRecordNo: string;
  lastTouchSummary: string;
  nextAction: string;
  tags: string[];
};

export type UpdateCustomerPayload = Partial<CreateCustomerPayload> & {
  id: string;
};

export type CreateAppointmentPayload = {
  customerId: string;
  customerDisplayName: string;
  project: string;
  scheduledAt: string;
  consultantUserId: string;
  status: AppointmentStatus;
  note: string;
};

export type UpdateAppointmentPayload = {
  id: string;
  status: AppointmentStatus;
  note: string;
};

export type FollowUpTransitionPayload = {
  id: string;
  nextStatus: FollowUpStatus;
};

const forbiddenKeys = new Set([
  'tenantId',
  'phoneNumber',
  'idNumber',
  'medicalRecordNo',
  'treatmentRecord',
  'consultationTranscript',
  'rawPhone',
  'rawIdCard',
]);

const customerLifecycleValues = new Set<CustomerLifecycleStage>([
  'consulting',
  'scheduled',
  'post_care',
  'repurchase_window',
  'silent_reactivation',
]);

const customerPriorityValues = new Set<CustomerPriority>(['high', 'medium', 'observe']);

const appointmentStatusValues = new Set<AppointmentStatus>([
  'pending_confirmation',
  'confirmed',
  'arrived',
  'completed',
  'reschedule_requested',
  'cancelled',
]);

const followUpStatusValues = new Set<FollowUpStatus>([
  'scheduled',
  'due',
  'in_progress',
  'escalated',
  'completed',
  'cancelled',
]);

const customerFieldKeys = [
  'displayName',
  'lifecycle',
  'priority',
  'ownerUserId',
  'projectInterest',
  'maskedPhone',
  'maskedMedicalRecordNo',
  'lastTouchSummary',
  'nextAction',
  'tags',
] as const;

const customerStringKeys = [
  'displayName',
  'ownerUserId',
  'projectInterest',
  'maskedPhone',
  'maskedMedicalRecordNo',
  'lastTouchSummary',
  'nextAction',
] as const;

const createAppointmentStringKeys = [
  'customerId',
  'customerDisplayName',
  'project',
  'scheduledAt',
  'consultantUserId',
  'note',
] as const;

const isoLikeTimestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function isPlainJsonObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

function validateObjectAndKeys(
  input: unknown,
  allowedKeys: readonly string[],
): TenantBusinessWriteParseResult<Record<string, unknown>> {
  if (!isPlainJsonObject(input)) {
    return { ok: false, error: '请求体必须是 JSON object' };
  }

  const allowedKeySet = new Set(allowedKeys);
  for (const key of Object.keys(input)) {
    if (forbiddenKeys.has(key)) {
      return { ok: false, error: `请求包含不允许的字段: ${key}` };
    }
  }

  for (const key of Object.keys(input)) {
    if (!allowedKeySet.has(key)) {
      return { ok: false, error: `请求包含不允许的字段: ${key}` };
    }
  }

  return { ok: true, value: input };
}

function parseRequiredString(
  input: Record<string, unknown>,
  key: string,
): TenantBusinessWriteParseResult<string> {
  const value = input[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { ok: false, error: `字段 ${key} 必须是非空字符串` };
  }

  return { ok: true, value: value.trim() };
}

function parseOptionalString(
  input: Record<string, unknown>,
  key: string,
): TenantBusinessWriteParseResult<string | undefined> {
  if (!(key in input)) {
    return { ok: true, value: undefined };
  }

  return parseRequiredString(input, key);
}

function parseEnum<T extends string>(
  input: Record<string, unknown>,
  key: string,
  allowedValues: Set<T>,
): TenantBusinessWriteParseResult<T> {
  const value = input[key];
  if (typeof value !== 'string' || !allowedValues.has(value as T)) {
    return { ok: false, error: `字段 ${key} 值不在允许范围内` };
  }

  return { ok: true, value: value as T };
}

function parseOptionalEnum<T extends string>(
  input: Record<string, unknown>,
  key: string,
  allowedValues: Set<T>,
): TenantBusinessWriteParseResult<T | undefined> {
  if (!(key in input)) {
    return { ok: true, value: undefined };
  }

  return parseEnum(input, key, allowedValues);
}

function parseTags(
  input: Record<string, unknown>,
  options: { defaultEmpty: boolean },
): TenantBusinessWriteParseResult<string[] | undefined> {
  if (!('tags' in input)) {
    return { ok: true, value: options.defaultEmpty ? [] : undefined };
  }

  const value = input.tags;
  if (!Array.isArray(value) || !value.every((tag) => typeof tag === 'string')) {
    return { ok: false, error: '字段 tags 必须是字符串数组' };
  }

  const tags = value.map((tag) => tag.trim());
  if (tags.some((tag) => tag.length === 0)) {
    return { ok: false, error: '字段 tags 必须是非空字符串数组' };
  }

  return {
    ok: true,
    value: tags,
  };
}

function parseScheduledAt(input: Record<string, unknown>): TenantBusinessWriteParseResult<string> {
  const scheduledAt = parseRequiredString(input, 'scheduledAt');
  if (!scheduledAt.ok) {
    return scheduledAt;
  }

  if (!isValidIsoLikeTimestamp(scheduledAt.value)) {
    return { ok: false, error: '字段 scheduledAt 必须是有效时间字符串' };
  }

  return scheduledAt;
}

function isValidIsoLikeTimestamp(value: string): boolean {
  const match = isoLikeTimestampPattern.exec(value);
  if (!match) {
    return false;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zoneText] = match;
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

export function parseCreateCustomerPayload(
  input: unknown,
): TenantBusinessWriteParseResult<CreateCustomerPayload> {
  const objectResult = validateObjectAndKeys(input, customerFieldKeys);
  if (!objectResult.ok) {
    return objectResult;
  }

  const object = objectResult.value;
  const lifecycle = parseEnum(object, 'lifecycle', customerLifecycleValues);
  if (!lifecycle.ok) {
    return lifecycle;
  }

  const priority = parseEnum(object, 'priority', customerPriorityValues);
  if (!priority.ok) {
    return priority;
  }

  const strings = {} as Pick<CreateCustomerPayload, (typeof customerStringKeys)[number]>;
  for (const key of customerStringKeys) {
    const value = parseRequiredString(object, key);
    if (!value.ok) {
      return value;
    }
    strings[key] = value.value;
  }

  const tags = parseTags(object, { defaultEmpty: true });
  if (!tags.ok) {
    return tags;
  }

  return {
    ok: true,
    value: {
      ...strings,
      lifecycle: lifecycle.value,
      priority: priority.value,
      tags: tags.value ?? [],
    },
  };
}

export function parseUpdateCustomerPayload(
  input: unknown,
): TenantBusinessWriteParseResult<UpdateCustomerPayload> {
  const objectResult = validateObjectAndKeys(input, ['id', ...customerFieldKeys]);
  if (!objectResult.ok) {
    return objectResult;
  }

  const object = objectResult.value;
  const id = parseRequiredString(object, 'id');
  if (!id.ok) {
    return id;
  }

  const value: UpdateCustomerPayload = { id: id.value };
  const lifecycle = parseOptionalEnum(object, 'lifecycle', customerLifecycleValues);
  if (!lifecycle.ok) {
    return lifecycle;
  }
  if (lifecycle.value !== undefined) {
    value.lifecycle = lifecycle.value;
  }

  const priority = parseOptionalEnum(object, 'priority', customerPriorityValues);
  if (!priority.ok) {
    return priority;
  }
  if (priority.value !== undefined) {
    value.priority = priority.value;
  }

  for (const key of customerStringKeys) {
    const field = parseOptionalString(object, key);
    if (!field.ok) {
      return field;
    }
    if (field.value !== undefined) {
      value[key] = field.value;
    }
  }

  const tags = parseTags(object, { defaultEmpty: false });
  if (!tags.ok) {
    return tags;
  }
  if (tags.value !== undefined) {
    value.tags = tags.value;
  }

  if (Object.keys(value).length === 1) {
    return { ok: false, error: '至少提供一个可更新字段' };
  }

  return { ok: true, value };
}

export function parseCreateAppointmentPayload(
  input: unknown,
): TenantBusinessWriteParseResult<CreateAppointmentPayload> {
  const objectResult = validateObjectAndKeys(input, [
    ...createAppointmentStringKeys,
    'status',
  ]);
  if (!objectResult.ok) {
    return objectResult;
  }

  const object = objectResult.value;
  const scheduledAt = 'scheduledAt' in object ? parseScheduledAt(object) : undefined;
  if (scheduledAt && !scheduledAt.ok) {
    return scheduledAt;
  }

  const strings = {} as Pick<CreateAppointmentPayload, (typeof createAppointmentStringKeys)[number]>;
  for (const key of createAppointmentStringKeys) {
    const value =
      key === 'scheduledAt' ? scheduledAt ?? parseScheduledAt(object) : parseRequiredString(object, key);
    if (!value.ok) {
      return value;
    }
    strings[key] = value.value;
  }

  const status = parseEnum(object, 'status', appointmentStatusValues);
  if (!status.ok) {
    return status;
  }

  return {
    ok: true,
    value: {
      ...strings,
      status: status.value,
    },
  };
}

export function parseUpdateAppointmentPayload(
  input: unknown,
): TenantBusinessWriteParseResult<UpdateAppointmentPayload> {
  const objectResult = validateObjectAndKeys(input, ['id', 'status', 'note']);
  if (!objectResult.ok) {
    return objectResult;
  }

  const object = objectResult.value;
  const id = parseRequiredString(object, 'id');
  if (!id.ok) {
    return id;
  }

  const status = parseEnum(object, 'status', appointmentStatusValues);
  if (!status.ok) {
    return status;
  }

  const note = parseRequiredString(object, 'note');
  if (!note.ok) {
    return note;
  }

  return {
    ok: true,
    value: {
      id: id.value,
      status: status.value,
      note: note.value,
    },
  };
}

export function parseFollowUpTransitionPayload(
  input: unknown,
): TenantBusinessWriteParseResult<FollowUpTransitionPayload> {
  const objectResult = validateObjectAndKeys(input, ['id', 'nextStatus']);
  if (!objectResult.ok) {
    return objectResult;
  }

  const object = objectResult.value;
  const id = parseRequiredString(object, 'id');
  if (!id.ok) {
    return id;
  }

  const nextStatus = parseEnum(object, 'nextStatus', followUpStatusValues);
  if (!nextStatus.ok) {
    return nextStatus;
  }

  return {
    ok: true,
    value: {
      id: id.value,
      nextStatus: nextStatus.value,
    },
  };
}
