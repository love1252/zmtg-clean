export type HisConnectionWriteMetadata = {
  connectionName: string;
  sourceSystem: string;
  vendorType: string;
  systemType: string;
};

export type CreateHisConnectionInput = HisConnectionWriteMetadata;

export type UpdateHisConnectionInput = Partial<HisConnectionWriteMetadata>;

export type HisConnectionWriteMetadataDto = HisConnectionWriteMetadata;

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

type WritableField = keyof HisConnectionWriteMetadata;

const writableFields = [
  'connectionName',
  'sourceSystem',
  'vendorType',
  'systemType',
] as const satisfies readonly WritableField[];

const writableFieldSet = new Set<string>(writableFields);

const fieldLengthLimits: Record<WritableField, number> = {
  connectionName: 160,
  sourceSystem: 64,
  vendorType: 64,
  systemType: 64,
};

const forbiddenFields = [
  'tenantId',
  'id',
  'connectionId',
  'status',
  'credentialRef',
  'credentialConfigured',
  'healthStatus',
  'lastCheckedAt',
  'lastErrorCode',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'revokedAt',
  'deletedAt',
  'token',
  'secret',
  'apiKey',
  'oauthToken',
  'basicAuth',
  'signingKey',
  'privateKey',
  'connectionString',
  'rawPayload',
  'requestBody',
  'responseBody',
  'sql',
  'stack',
  'DATABASE_URL',
  'API key',
  'api_key',
  'OAuth token',
  'oauth_token',
  'basic auth',
  'basic_auth',
  'private key',
  'private_key',
  'connection string',
  'connection_string',
  'raw payload',
  'raw_payload',
] as const;

const forbiddenFieldSet = new Set<string>(forbiddenFields);
const normalizedForbiddenFieldSet = new Set<string>(forbiddenFields.map(normalizeFieldKey));

const sensitiveContentPattern =
  /credential(?:Ref|_ref)?|token|secret|api\s*key|api_key|apikey|oauth\s*token|oauth_token|oauthtoken|basic\s*auth|basic_auth|basicauth|signing\s*key|signing_key|signingkey|private\s*key|private_key|privatekey|connection\s*string|connection_string|connectionstring|raw\s*payload|raw_payload|rawpayload|request\s*body|request_body|requestbody|response\s*body|response_body|responsebody|DATABASE_URL|database_url|postgres:\/\/|mysql:\/\/|mongodb:\/\/|redis:\/\/|\bsql\b|select\s+.+\s+from|insert\s+into|update\s+.+\s+set|delete\s+from|\bstack\b|sk_(?:live|test|proj)[A-Za-z0-9_=-]*|完整治疗正文|完整病历正文|咨询全文|图片\s*\/\s*文件原文/iu;

function normalizeFieldKey(key: string) {
  return key.normalize('NFKC').replace(/[\s_-]+/g, '').toLowerCase();
}

function isPlainJsonObject(input: unknown): input is Record<string, unknown> {
  return (
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input) &&
    Object.getPrototypeOf(input) === Object.prototype
  );
}

function hasOwnField(input: Record<string, unknown>, field: WritableField) {
  return Object.prototype.hasOwnProperty.call(input, field);
}

function isForbiddenField(key: string) {
  return forbiddenFieldSet.has(key) || normalizedForbiddenFieldSet.has(normalizeFieldKey(key));
}

function parsePayloadObject(input: unknown): ParseResult<Record<string, unknown>> {
  if (!isPlainJsonObject(input)) {
    return { ok: false, error: '请求体必须是普通 JSON 对象' };
  }

  for (const key of Object.keys(input)) {
    if (writableFieldSet.has(key)) {
      continue;
    }

    if (isForbiddenField(key)) {
      return { ok: false, error: '请求包含不允许的字段' };
    }

    return { ok: false, error: `请求包含不允许的字段: ${key}` };
  }

  return { ok: true, value: input };
}

function parseStringField(
  input: Record<string, unknown>,
  field: WritableField,
): ParseResult<string> {
  const rawValue = input[field];
  if (typeof rawValue !== 'string') {
    return { ok: false, error: `字段 ${field} 必须是非空字符串` };
  }

  const value = rawValue.trim();
  if (!value) {
    return { ok: false, error: `字段 ${field} 必须是非空字符串` };
  }

  const limit = fieldLengthLimits[field];
  if (value.length > limit) {
    return { ok: false, error: `字段 ${field} 长度不能超过 ${limit}` };
  }

  if (sensitiveContentPattern.test(value)) {
    return { ok: false, error: `字段 ${field} 不允许包含敏感信息` };
  }

  return { ok: true, value };
}

export function parseCreateHisConnectionInput(
  input: unknown,
): ParseResult<CreateHisConnectionInput> {
  const payload = parsePayloadObject(input);
  if (!payload.ok) {
    return payload;
  }

  const value = {} as CreateHisConnectionInput;
  for (const field of writableFields) {
    const parsedField = parseStringField(payload.value, field);
    if (!parsedField.ok) {
      return parsedField;
    }

    value[field] = parsedField.value;
  }

  return { ok: true, value };
}

export function parseUpdateHisConnectionInput(
  input: unknown,
): ParseResult<UpdateHisConnectionInput> {
  const payload = parsePayloadObject(input);
  if (!payload.ok) {
    return payload;
  }

  if (Object.keys(payload.value).length === 0) {
    return { ok: false, error: '请求至少包含一个可更新字段' };
  }

  const value: UpdateHisConnectionInput = {};
  for (const field of writableFields) {
    if (!hasOwnField(payload.value, field)) {
      continue;
    }

    const parsedField = parseStringField(payload.value, field);
    if (!parsedField.ok) {
      return parsedField;
    }

    value[field] = parsedField.value;
  }

  return { ok: true, value };
}

export function mapHisConnectionWriteMetadataToDto(
  input: HisConnectionWriteMetadata,
): HisConnectionWriteMetadataDto {
  return {
    connectionName: input.connectionName,
    sourceSystem: input.sourceSystem,
    vendorType: input.vendorType,
    systemType: input.systemType,
  };
}
